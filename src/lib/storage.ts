/**
 * SomaShare storage layer — "Every student brings the storage."
 *
 * Uploads live in the CONTRIBUTOR'S own Google Drive (drive.file scope),
 * so platform storage cost stays ~zero and grows with the community.
 * Downloads stream through the app using the uploader's stored
 * (encrypted) refresh token — files are shared view-only with anyone
 * holding the link, but are only distributed to signed-in students.
 *
 * Providers:
 *
 *  - SandboxDriveProvider (default in dev) — simulates Drive on the
 *    local filesystem so the full product flow works with zero config.
 *
 *  - PerUserDriveProvider (production) — talks to Drive REST v3 with
 *    the individual student's OAuth refresh token. Each student uploads
 *    to THEIR Drive; peers download through the app.
 *
 * The rest of the app depends only on the StorageProvider interface +
 * providerForUser(), so providers stay swappable with zero API changes.
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync } from "fs";
import path from "path";
import { createHash, randomBytes } from "crypto";
import { refreshAccessToken, oauthConfigured } from "./google";

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
    const dir = path.join(STORAGE_DIR);
    const match = existsSync(dir) ? readdirSync(dir).find((f) => f.startsWith(driveFileId)) : undefined;
    if (match) unlinkSync(path.join(dir, match));
  }

  describe(): string {
    return "Sandbox Drive — simulated storage for development";
  }
}

/* ------------------------------------------------------------------ */
/* Production provider — per-student Google Drive (REST API v3)        */
/* ------------------------------------------------------------------ */

const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
const API_BASE = "https://www.googleapis.com/drive/v3/files";

/* Small in-memory cache: refresh-token-hash → {accessToken, exp} so we
 * don't hit Google's token endpoint on every request within a lambda. */
const tokenCache = new Map<string, { token: string; exp: number }>();

async function accessTokenFor(refreshToken: string): Promise<string> {
  const cacheKey = createHash("sha256").update(refreshToken).digest("hex").slice(0, 32);
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;

  const { accessToken, expiresInSec } = await refreshAccessToken(refreshToken);
  tokenCache.set(cacheKey, { token: accessToken, exp: Date.now() + expiresInSec * 1000 });
  return accessToken;
}

export class PerUserDriveProvider implements StorageProvider {
  readonly name = "google-drive-per-user";

  constructor(private readonly refreshToken: string) {}

  async upload(bytes: Buffer, meta: DriveUploadMeta): Promise<StoredFile> {
    const token = await accessTokenFor(this.refreshToken);
    const boundary = `soma_${createHash("md5").update(meta.fileName + Date.now()).digest("hex")}`;
    const metadata = JSON.stringify({
      name: meta.fileName,
      mimeType: meta.mimeType,
      // drive.file scope: the app sees only the files it created
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
    if (!res.ok) throw new Error(`Drive upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    const file = (await res.json()) as { id: string; webViewLink?: string };

    // Share view-only with anyone holding the link (vault peers download via the app)
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
    const token = await accessTokenFor(this.refreshToken);
    const res = await fetch(`${API_BASE}/${driveFileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Drive read failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(driveFileId: string): Promise<void> {
    const token = await accessTokenFor(this.refreshToken);
    await fetch(`${API_BASE}/${driveFileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  describe(): string {
    return "Google Drive — files hosted on each contributor's own Drive (drive.file scope)";
  }
}

/* ------------------------------------------------------------------ */

/**
 * Pick the storage provider for an operation.
 *
 * @param userRefreshToken — the (decrypted) Drive refresh token of the
 *   user who OWNS the operation (uploader for uploads; the resource's
 *   original uploader for reads/deletes).
 *
 * Returns null when production OAuth is configured but the user has no
 * usable Drive token → callers respond with a clear "reconnect" error.
 */
export function providerForUser(userRefreshToken: string | null | undefined): StorageProvider | null {
  if (!oauthConfigured()) return new SandboxDriveProvider(); // dev/sandbox
  if (!userRefreshToken) return null; // production, Drive not connected
  return new PerUserDriveProvider(userRefreshToken);
}

/** True when the app runs against the simulated sandbox storage. */
export function isSandboxStorage(): boolean {
  return !oauthConfigured();
}
