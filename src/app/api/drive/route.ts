import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isSandboxStorage } from "@/lib/storage";
import { googleOAuthConfigured, isProd } from "@/lib/env";
import { decryptToken } from "@/lib/crypto";
import { revokeToken } from "@/lib/google";

/**
 * GET /api/drive — storage provider status for the current user.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const sandbox = isSandboxStorage();
  return NextResponse.json({
    connected: user.driveConnected,
    driveEmail: user.driveEmail,
    provider: sandbox ? "sandbox-drive" : "google-drive-per-user",
    providerDescription: sandbox
      ? "Sandbox Drive — simulated storage for development"
      : "Google Drive — files hosted on each contributor's own Drive (drive.file scope)",
    simulated: sandbox,
    oauthConfigured: googleOAuthConfigured(),
  });
}

/**
 * POST /api/drive  { action: "connect" | "disconnect" }
 *
 * Production: Drive connection happens during Google sign-in (the
 * drive.file consent) — "connect" is a no-op there; use "disconnect"
 * to revoke stored access.
 *
 * Sandbox (no Google credentials): "connect" records the simulated
 * linkage so the upload flow can be exercised end-to-end.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action;

  if (action === "connect") {
    if (isProd) {
      return NextResponse.json(
        { error: "Drive connection happens at Google sign-in. Sign out and sign in again to grant access." },
        { status: 400 }
      );
    }
    const updated = await db.user.update({
      where: { id: user.id },
      data: { driveConnected: true, driveEmail: user.driveEmail ?? user.email },
    });
    return NextResponse.json({ connected: updated.driveConnected, driveEmail: updated.driveEmail });
  }

  if (action === "disconnect") {
    // Revoke the stored refresh token so the student keeps full control.
    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    if (dbUser?.driveRefreshToken) {
      const refreshToken = decryptToken(dbUser.driveRefreshToken);
      if (refreshToken) void revokeToken(refreshToken);
    }
    const updated = await db.user.update({
      where: { id: user.id },
      data: { driveConnected: false, driveEmail: null, driveRefreshToken: null },
    });
    return NextResponse.json({
      connected: updated.driveConnected,
      driveEmail: updated.driveEmail,
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
