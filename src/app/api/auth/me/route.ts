import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { googleOAuthConfigured, isProd } from "@/lib/env";

/**
 * GET /api/auth/me — current session user (null if signed out), plus
 * public capability flags the login/upload screens rely on.
 */
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({
    user,
    googleConfigured: googleOAuthConfigured(),
    demoEnabled: !isProd,
  });
}
