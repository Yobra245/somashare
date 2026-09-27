import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { providerForUser } from "@/lib/storage";
import { decryptToken } from "@/lib/crypto";
import { limits } from "@/lib/rate-limit";
import { isProd } from "@/lib/env";
import { sanitizeFileName, isPdfBytes } from "@/lib/validate";
import type { ResourceDTO, ResourceType } from "@/lib/types";

const VALID_TYPES: ResourceType[] = ["LECTURE_NOTES", "PAST_PAPER", "REVISION_SLIDES", "ASSIGNMENT"];
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

// Case-insensitive search is native on Postgres; SQLite (sandbox) is case-sensitive.
const ON_POSTGRES = (process.env.DATABASE_URL ?? "").startsWith("postgres");

function serialize(r: {
  id: string;
  title: string;
  type: string;
  academicYear: string;
  examYear: number;
  semester: number;
  uploaderName: string;
  verified: boolean;
  downloadCount: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  webViewLink: string | null;
  createdAt: Date;
  unit: { id: string; code: string; title: string; department: string; shortLabel: string };
}): ResourceDTO {
  return {
    id: r.id,
    title: r.title,
    type: r.type as ResourceType,
    academicYear: r.academicYear,
    examYear: r.examYear,
    semester: r.semester,
    uploaderName: r.uploaderName,
    verified: r.verified,
    downloadCount: r.downloadCount,
    fileName: r.fileName,
    fileSize: r.fileSize,
    mimeType: r.mimeType,
    webViewLink: r.webViewLink,
    createdAt: r.createdAt.toISOString(),
    unit: r.unit,
  };
}

/**
 * GET /api/resources — the vault catalog. Requires a signed-in student:
 * the vault is student-only by design, not a public download site.
 *
 * Query: unitId?, type?, year?, semester?, q?, mine=1?, limit?
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const year = searchParams.get("year");
  const semester = searchParams.get("semester");
  const q = searchParams.get("q")?.trim();
  const mine = searchParams.get("mine") === "1";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);

  const where: Record<string, unknown> = {};
  if (unitId) where.unitId = unitId;
  if (type && type !== "ALL") where.type = type;
  if (year && year !== "ALL") where.examYear = parseInt(year, 10);
  if (semester && semester !== "ALL") where.semester = parseInt(semester, 10);
  if (mine) {
    where.uploaderId = user.id;
  }
  if (q) {
    const mode = ON_POSTGRES ? "insensitive" : undefined;
    where.OR = [
      { title: { contains: q, mode } },
      { uploaderName: { contains: q, mode } },
      { unit: { is: { code: { contains: q, mode } } } },
      { unit: { is: { title: { contains: q, mode } } } },
    ];
  }

  const rows = await db.resource.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { unit: true },
  });

  return NextResponse.json({ resources: rows.map(serialize) });
}

/**
 * POST /api/resources  (multipart/form-data)
 * Fields: unitId, title, type, academicYear, examYear, semester, consent=1,
 *         file (binary; PDF only — a text stub is allowed in dev when omitted).
 * Requires: signed-in student + connected Google Drive (BYO storage model).
 * Uploaded files land in the MODERATION QUEUE (verified=false) until an
 * admin reviews them.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!limits.upload(user.id).ok) {
    return NextResponse.json({ error: "Upload limit reached (10/hour). Try again later." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const unitId = String(form.get("unitId") ?? "");
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const type = String(form.get("type") ?? "");
  const academicYear = String(form.get("academicYear") ?? "Year 1").slice(0, 20);
  const examYear = parseInt(String(form.get("examYear") ?? "2025"), 10);
  const semester = parseInt(String(form.get("semester") ?? "1"), 10);
  const consent = form.get("consent") === "1" || form.get("consent") === "true";
  const file = form.get("file");

  if (!unitId || !title) {
    return NextResponse.json({ error: "Unit and document title are required." }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type as ResourceType)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }
  if (!Number.isFinite(examYear) || examYear < 2000 || examYear > 2100) {
    return NextResponse.json({ error: "Invalid exam year." }, { status: 400 });
  }
  if (semester !== 1 && semester !== 2) {
    return NextResponse.json({ error: "Semester must be 1 or 2." }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json(
      { error: "Google Drive Sharing Consent is required to publish to the vault." },
      { status: 400 }
    );
  }
  if (!user.driveConnected) {
    return NextResponse.json(
      { error: "Connect your Google Drive first — the vault runs on peer-contributed storage." },
      { status: 409 }
    );
  }

  const unit = await db.unit.findUnique({ where: { id: unitId } });
  if (!unit) return NextResponse.json({ error: "Unknown course unit." }, { status: 404 });

  // ---- file handling via the storage provider (BYO Google Drive) ----
  let bytes: Buffer;
  let fileName: string;
  let mimeType: string;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File too large (max 25 MB)." }, { status: 413 });
    }
    const declaredOk = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    bytes = Buffer.from(await file.arrayBuffer());
    if (!declaredOk || !isPdfBytes(bytes)) {
      return NextResponse.json(
        { error: "Only real PDF files are accepted (the vault distributes study documents)." },
        { status: 415 }
      );
    }
    fileName = sanitizeFileName(file.name, "document.pdf");
    if (!/\.pdf$/i.test(fileName)) fileName = `${fileName}.pdf`;
    mimeType = "application/pdf";
  } else if (isProd) {
    // Production always requires a real file — no implicit stubs in the live vault.
    return NextResponse.json({ error: "Attach a PDF file to publish." }, { status: 400 });
  } else {
    // No file attached (quick demo path) — publish a manifest stub so the
    // vault entry still exists and downloads work.
    bytes = Buffer.from(
      `SomaShare vault entry\nTitle: ${title}\nUnit: ${unit.code} ${unit.title}\nUploader: ${user.name}\n`,
      "utf8"
    );
    fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.txt`;
    mimeType = "text/plain";
  }

  // Resolve the uploader's Drive token (uploads go to THEIR Drive).
  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  const provider = providerForUser(dbUser?.driveRefreshToken ? decryptToken(dbUser.driveRefreshToken) : null);
  if (!provider) {
    return NextResponse.json(
      { error: "Your Google Drive access has expired — sign out and sign in again to reconnect." },
      { status: 409 }
    );
  }

  const stored = await provider.upload(bytes, {
    fileName,
    mimeType,
    ownerEmail: user.driveEmail ?? user.email,
    title,
  });

  const resource = await db.resource.create({
    data: {
      title,
      unitId: unit.id,
      type,
      academicYear,
      examYear,
      semester,
      uploaderName: user.name,
      uploaderId: user.id,
      fileName,
      fileSize: stored.size,
      mimeType,
      driveFileId: stored.driveFileId,
      webViewLink: stored.webViewLink,
      // Moderation: an admin reviews before the "verified" badge appears.
      verified: false,
    },
    include: { unit: true },
  });

  return NextResponse.json({ resource: serialize(resource) }, { status: 201 });
}
