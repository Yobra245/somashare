import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { buildSessionCookie, clearSessionCookie, isValidStudentEmail } from "@/lib/auth";
import { exchangeCode, fetchUserInfo } from "@/lib/google";
import { encryptToken } from "@/lib/crypto";
import { isProd } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { requestOrigin } from "../start/route";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * GET /api/auth/google/callback
 * Finishes the OAuth flow: verify state, exchange the code, enforce the
 * @ku.ac.ke domain server-side, upsert the student, store the Drive
 * refresh token (encrypted) when the drive.file scope was granted, and
 * open a session.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (code: string) => NextResponse.redirect(new URL(`/?auth_error=${code}`, url.origin));

  // Abuse guard: the callback is cheap but not free.
  if (!rateLimit(`oauth:${requestOrigin(req)}`, 30, 60 * 1000).ok) return fail("rate");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("missing_params");

  // CSRF: state must match the cookie we set in /start
  const stateCookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("soma_oauth_state="))
    ?.split("=")[1];
  if (!stateCookie || stateCookie.length !== state.length) {
    await clearSessionCookie();
    return fail("state");
  }
  if (!timingSafeEqual(Buffer.from(stateCookie), Buffer.from(state))) {
    return fail("state");
  }

  let userInfo;
  let tokens;
  try {
    tokens = await exchangeCode(code, `${requestOrigin(req)}/api/auth/google/callback`);
    userInfo = await fetchUserInfo(tokens.accessToken);
  } catch (err) {
    console.error("oauth callback error", err);
    return fail("exchange");
  }

  // Launch restriction — enforced SERVER-SIDE on the verified email.
  if (!userInfo.emailVerified || !isValidStudentEmail(userInfo.email)) {
    return fail("domain");
  }

  const driveGranted = tokens.scope.includes(DRIVE_SCOPE);

  // Find-or-create the student. Profile fields (department, year) are set
  // once at signup and intentionally NOT overwritten by later sign-ins.
  const user = await db.user.upsert({
    where: { email: userInfo.email },
    update: {
      // name tracks the verified Google profile
      name: userInfo.name,
      ...(driveGranted && tokens.refreshToken
        ? { driveConnected: true, driveEmail: userInfo.email, driveRefreshToken: encryptToken(tokens.refreshToken) }
        : {}),
    },
    create: {
      email: userInfo.email,
      name: userInfo.name,
      ...(driveGranted && tokens.refreshToken
        ? { driveConnected: true, driveEmail: userInfo.email, driveRefreshToken: encryptToken(tokens.refreshToken) }
        : {}),
    },
  });

  const cookie = buildSessionCookie(user.id);
  const res = NextResponse.redirect(new URL("/", url.origin));
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  res.cookies.set("soma_oauth_state", "", { httpOnly: true, path: "/", maxAge: 0, secure: isProd });
  return res;
}
