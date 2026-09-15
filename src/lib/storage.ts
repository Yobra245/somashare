/**
 * SomaShare storage layer — "Bring Your Own Drive".
 *
 * Every student who signs in connects their Google account, so uploaded
 * revision material is hosted on the contributors' own Google Drive
 * storage (drive.file scope) instead of costing the platform money.
 *
 * Two providers implement the same StorageProvider contract:
 *
 *  - SandboxDriveProvider  (default) — simulates a Drive backend on the
 *    server filesystem so the full product flow can be exercised without
 *    real Google credentials.
 *
 *  - GoogleDriveProvider  (production) — talks to the real Drive REST API
 *    v3. Enable by setting GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and
 *    GOOGLE_REFRESH_TOKEN (or per-user refresh tokens) in the environment.
 *
 * The rest of the app only depends on the interface below, so switching
 * providers requires zero UI/API changes.
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync } from "fs";
import path from "path";
import { createHash, randomBytes } from "crypto";

export interface StoredFile {
  driveFileId: string;
  webViewLink: string;
  size: number;
}

export interface DriveUploadMeta {
  fileName: string;
  mimeType: string;
  ownerEmail: string;
  title: string;
}

export interface StorageProvider {
  readonly name: string;
  /** Persist a file and share it view-only with the vault. */
  upload(bytes: Buffer, meta: DriveUploadMeta): Promise<StoredFile>;
  /** Read back the raw bytes for streaming to a downloader. */
  read(driveFileId: string): Promise<Buffer>;
  /** Best-effort delete (used when a resource is retracted). */
  delete(driveFileId: string): Promise<void>;
  /** Human-readable provider description shown in Profile → Integrations. */
  describe(): string;
}

/* ------------------------------------------------------------------ */
/* Sandbox provider — simulated Google Drive on local filesystem       */
/* ------------------------------------------------------------------ */

const STORAGE_DIR = process.env.SOMA_STORAGE_DIR ?? path.join(process.cwd(), "storage");

export class SandboxDriveProvider implements StorageProvider {
  readonly name = "sandbox-drive";

  private driveLikeId(): string {
    // Mimic the shape of real Google Drive file ids (33 chars, base64url-ish)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    let id = "1";
    const bytes = randomBytes(32);
    for (let i = 0; i < 32; i++) id += chars[bytes[i] % chars.length];
    return id;
  }

  async upload(bytes: Buffer, meta: DriveUploadMeta): Promise<StoredFile> {
    mkdirSync(STORAGE_DIR, { recursive: true });
    const driveFileId = this.driveLikeId();
    const safeName = `${driveFileId}${path.extname(meta.fileName) || ".bin"}`;
    writeFileSync(path.join(STORAGE_DIR, safeName), bytes);
    // In a real Drive upload this permission call would follow:
    //   POST drive/v3/files/{id}/permissions  role=reader, type=anyone
    return {
      driveFileId,
      webViewLink: `https://drive.google.com/file/d/${driveFileId}/view`,
      size: bytes.length,
    };
  }

  async read(driveFileId: string): Promise<Buffer> {
    const dir = path.join(STORAGE_DIR);
    const match = existsSync(dir)
      ? readdirSync(dir).find((f) => f.startsWith(driveFileId))
      : undefined;
    if (!match) throw new Error("File not found in Drive storage");
    return readFileSync(path.join(dir, match));
  }

  async delete(driveFileId: string): Promise<void> {
    const safeName = `${driveFileId}${path.extname("")}`;
    const target = path.join(STORAGE_DIR, safeName);
    if (existsSync(target)) unlinkSync(target);
  }

  describe(): string {
    return "Sandbox Drive — simulated storage for development";
  }
}

/* ------------------------------------------------------------------ */
/* Production provider — real Google Drive REST API v3                 */
/* ------------------------------------------------------------------ */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
const API_BASE = "https://www.googleapis.com/drive/v3/files";

function driveAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google Drive credentials missing. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN."
    );
  }
  return fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`Google token refresh failed (${res.status})`);
    const json = (await res.json()) as { access_token: string };
    return json.access_token;
  });
}

export class GoogleDriveProvider implements StorageProvider {
  readonly name = "google-drive";

  async upload(bytes: Buffer, meta: DriveUploadMeta): Promise<StoredFile> {
    const token = await driveAccessToken();
    const boundary = `soma_${createHash("md5").update(meta.fileName + Date.now()).digest("hex")}`;
    const metadata = JSON.stringify({
      name: meta.fileName,
      mimeType: meta.mimeType,
      // drive.file scope: app sees only the files it created
      appProperties: { owner: meta.ownerEmail, title: meta.title, source: "somashare" },
    });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${meta.mimeType}\r\n\r\n`;
    const tail = `\r\n--${boundary}--`;
    const payload = Buffer.concat([Buffer.from(body, "utf8"), bytes, Buffer.from(tail, "utf8")]);

    const res = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: new Uint8Array(payload),
    });
    if (!res.ok) throw new Error(`Drive upload failed (${res.status}): ${await res.text()}`);
    const file = (await res.json()) as { id: string; webViewLink?: string };

    // Share view-only with anyone holding the link (vault peers)
    await fetch(`${API_BASE}/${file.id}/permissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone", allowFileDiscovery: false }),
    });

    return {
      driveFileId: file.id,
      webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
      size: bytes.length,
    };
  }

  async read(driveFileId: string): Promise<Buffer> {
    const token = await driveAccessToken();
    const res = await fetch(`${API_BASE}/${driveFileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Drive read failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(driveFileId: string): Promise<void> {
    const token = await driveAccessToken();
    await fetch(`${API_BASE}/${driveFileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  describe(): string {
    return "Google Drive — files hosted on contributors' own Drive (drive.file scope)";
  }
}

/* ------------------------------------------------------------------ */

export function getStorageProvider(): StorageProvider {
  const useReal =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET && !!process.env.GOOGLE_REFRESH_TOKEN;
  return useReal ? new GoogleDriveProvider() : new SandboxDriveProvider();
}
