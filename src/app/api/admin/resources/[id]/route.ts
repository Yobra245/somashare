import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { providerForUser } from "@/lib/storage";
import { decryptToken } from "@/lib/crypto";

/**
 * POST /api/admin/resources/[id]  { action: "verify" | "unverify" | "delete" }
 * Moderation actions. Delete also removes the stored file from the
 * contributor's Drive (best-effort). Admin only.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };

  if (body.action === "verify" || body.action === "unverify") {
    const updated = await db.resource.update({
      where: { id },
      data: { verified: body.action === "verify" },
    });
    return NextResponse.json({ ok: true, verified: updated.verified });
  }

  if (body.action === "delete") {
    const resource = await db.resource.findUnique({
      where: { id },
      include: { uploader: { select: { driveRefreshToken: true } } },
    });
    if (!resource) return NextResponse.json({ error: "Resource not found." }, { status: 404 });

    // Remove the stored file first (best-effort), then the metadata.
    if (resource.driveFileId) {
      const provider = providerForUser(
        resource.uploader?.driveRefreshToken ? decryptToken(resource.uploader.driveRefreshToken) : null
      );
      if (provider) {
        try {
          await provider.delete(resource.driveFileId);
        } catch (err) {
          console.warn("moderation file delete failed", err);
        }
      }
    }
    await db.download.deleteMany({ where: { resourceId: id } });
    await db.resource.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
