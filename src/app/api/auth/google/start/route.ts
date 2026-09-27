import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { googleAuthUrl } from "@/lib/google";
import { appUrl } from "@/lib/env";

/**
 * GET /api/auth/google/start
 * Kicks off the Google OAuth consent (identity + drive.file storage).
 * Sets a short-lived state cookie for CSRF protection, then redirects.
 */
export async function GET(req: Request) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/?auth_error=unconfigured", req.url));
  }

  const state = randomBytes(24).toString("hex");
  const origin = requestOrigin(req);
  const redirectUri = `${origin}/api/auth/google/callback`;

  const res = NextResponse.redirect(googleAuthUrl(redirectUri, state));
  const secure = origin.startsWith("https://");
  res.cookies.set("soma_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600, // 10 minutes to complete consent
  });
  return res;
}

/** Public origin of this deployment (APP_URL wins; else proxy headers; else request URL). */
export function requestOrigin(req: Request): string {
  const configured = appUrl();
  if (configured && configured !== "http://localhost:3000") return configured;

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}
