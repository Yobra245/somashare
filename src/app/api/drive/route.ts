import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage";

/**
 * GET /api/drive — storage provider status for the current user.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const provider = getStorageProvider();
  return NextResponse.json({
    connected: user.driveConnected,
    driveEmail: user.driveEmail,
    provider: provider.name,
    providerDescription: provider.describe(),
    simulated: provider.name === "sandbox-drive",
  });
}

/**
 * POST /api/drive  { action: "connect" | "disconnect", email? }
 *
 * connect:
 *   - Sandbox (no Google credentials configured): records the Drive
 *     linkage directly, simulating a successful OAuth consent for the
 *     drive.file scope.
 *   - Production: the client first completes Google OAuth (steps in
 *     src/lib/google-oauth-guide.ts) and the resulting refresh token is
 *     exchanged server-side; then this endpoint records the linkage.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; email?: string };
  const action = body.action;

  if (action === "connect") {
    const driveEmail = (body.email ?? user.email).trim().toLowerCase();
    const updated = await db.user.update({
      where: { id: user.id },
      data: { driveConnected: true, driveEmail },
    });
    return NextResponse.json({
      connected: updated.driveConnected,
      driveEmail: updated.driveEmail,
    });
  }

  if (action === "disconnect") {
    const updated = await db.user.update({
      where: { id: user.id },
      data: { driveConnected: false, driveEmail: null },
    });
    return NextResponse.json({
      connected: updated.driveConnected,
      driveEmail: updated.driveEmail,
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
