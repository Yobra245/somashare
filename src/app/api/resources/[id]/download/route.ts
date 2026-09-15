import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage";

/**
 * GET /api/resources/[id]/download?inline=1
 * Streams the file bytes from the contributor's Drive storage,
 * increments the download counter and records the event.
 * The service worker caches this response for offline access.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const resource = await db.resource.findUnique({ where: { id } });
  if (!resource?.driveFileId) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  const provider = getStorageProvider();
  let bytes: Buffer;
  try {
    bytes = await provider.read(resource.driveFileId);
  } catch (err) {
    console.error("drive read failed", err);
    return NextResponse.json({ error: "Stored file could not be retrieved." }, { status: 502 });
  }

  // fire-and-forget stats (never block the download)
  void (async () => {
    try {
      const user = await getSessionUser();
      await db.resource.update({
        where: { id },
        data: { downloadCount: { increment: 1 } },
      });
      await db.download.create({
        data: { resourceId: id, userId: user?.id ?? null },
      });
    } catch {
      /* stats are best-effort */
    }
  })();

  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const body = new Uint8Array(bytes);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": resource.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${resource.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
