import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { providerForUser } from "@/lib/storage";
import { decryptToken } from "@/lib/crypto";
import { limits } from "@/lib/rate-limit";
import { sanitizeFileName } from "@/lib/validate";

/**
 * GET /api/resources/[id]/download?inline=1
 * Streams the file bytes from the contributor's Drive storage,
 * increments the download counter and records the event.
 * The service worker caches this response for offline access.
 *
 * Requires a signed-in student — the vault is not a public mirror.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!limits.download(user.id).ok) {
    return NextResponse.json({ error: "Slow down a little — too many downloads." }, { status: 429 });
  }

  const { id } = await ctx.params;

  const resource = await db.resource.findUnique({
    where: { id },
    include: { uploader: { select: { driveRefreshToken: true } } },
  });
  if (!resource?.driveFileId) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  // Files are read from the ORIGINAL UPLOADER's Drive (their stored token).
  const provider = providerForUser(
    resource.uploader?.driveRefreshToken ? decryptToken(resource.uploader.driveRefreshToken) : null
  );
  if (!provider) {
    return NextResponse.json(
      { error: "The contributor's Drive storage is temporarily unreachable. Please try again later." },
      { status: 502 }
    );
  }

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
      await db.resource.update({
        where: { id },
        data: { downloadCount: { increment: 1 } },
      });
      await db.download.create({
        data: { resourceId: id, userId: user.id },
      });
    } catch {
      /* stats are best-effort */
    }
  })();

  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const safeName = sanitizeFileName(resource.fileName, "document");
  const body = new Uint8Array(bytes);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": resource.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
