import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/**
 * GET /api/admin/resources?status=pending|all
 * Moderation queue — resources awaiting review. Admin only.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  const where = status === "all" ? {} : { verified: false };

  const rows = await db.resource.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { unit: true, uploader: { select: { email: true } } },
  });

  return NextResponse.json({
    resources: rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      academicYear: r.academicYear,
      examYear: r.examYear,
      semester: r.semester,
      uploaderName: r.uploaderName,
      uploaderEmail: r.uploader?.email ?? null,
      verified: r.verified,
      downloadCount: r.downloadCount,
      fileName: r.fileName,
      fileSize: r.fileSize,
      webViewLink: r.webViewLink,
      createdAt: r.createdAt.toISOString(),
      unit: { id: r.unit.id, code: r.unit.code, title: r.unit.title, shortLabel: r.unit.shortLabel },
    })),
  });
}
