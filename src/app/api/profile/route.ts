import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { DRIVE_CONTRIBUTION_REQUIRED } from "@/lib/types";

/**
 * GET /api/profile — session user, contribution stats and uploads
 * (powers the Profile screen: Drive contribution progress + My Uploads).
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const uploads = await db.resource.findMany({
    where: { uploaderId: session.id },
    orderBy: { createdAt: "desc" },
    include: { unit: true },
  });

  const verifiedCount = uploads.filter((u) => u.verified).length;

  return NextResponse.json({
    user: session,
    stats: {
      contributionCount: verifiedCount,
      totalUploads: uploads.length,
      requiredCount: DRIVE_CONTRIBUTION_REQUIRED,
      perksUnlocked: verifiedCount >= DRIVE_CONTRIBUTION_REQUIRED,
    },
    uploads: uploads.map((u) => ({
      id: u.id,
      title: u.title,
      type: u.type,
      academicYear: u.academicYear,
      examYear: u.examYear,
      semester: u.semester,
      uploaderName: u.uploaderName,
      verified: u.verified,
      downloadCount: u.downloadCount,
      fileName: u.fileName,
      fileSize: u.fileSize,
      mimeType: u.mimeType,
      webViewLink: u.webViewLink,
      createdAt: u.createdAt.toISOString(),
      unit: {
        id: u.unit.id,
        code: u.unit.code,
        title: u.unit.title,
        department: u.unit.department,
        shortLabel: u.unit.shortLabel,
      },
    })),
  });
}
