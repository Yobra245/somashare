/**
 * Session auth for SomaShare.
 *
 * Students sign in with Google (restricted to @ku.ac.ke — see
 * src/lib/google.ts and /api/auth/google/*). After the OAuth callback we
 * issue our own compact, HMAC-signed, expiring session token in an
 * httpOnly cookie. No third-party session dependency.
 *
 * Hardening rules enforced here:
 *  - SESSION_SECRET is required in production (see lib/env.ts) — the old
 *    hardcoded fallback would have allowed forged sessions.
 *  - Tokens expire (30 days) — expiry is part of the signed payload.
 *  - Cookies are Secure + __Secure- prefixed in production.
 *  - Signature comparison is timing-safe.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sessionSecret, isProd, isAdminEmail } from "@/lib/env";
import type { SessionUser } from "@/lib/types";

const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
const COOKIE_NAME = isProd ? "__Secure-soma_session" : "soma_session";
export const STUDENT_EMAIL_DOMAIN = "@ku.ac.ke";

export interface SessionUserWithAdmin extends SessionUser {
  isAdmin: boolean;
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

/** Token format: {userId}.{expiresAtMs}.{hmac(userId.expiresAtMs)} */
export function createToken(userId: string, maxAgeSec = MAX_AGE_SEC): string {
  const exp = Date.now() + maxAgeSec * 1000;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string): { userId: string; expiresAtMs: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expRaw, sig] = parts as [string, string, string];
  const exp = Number.parseInt(expRaw, 10);
  if (!Number.isFinite(exp) || exp <= 0) return null;
  if (exp <= Date.now()) return null; // expired

  const expected = Buffer.from(sign(`${userId}.${expRaw}`));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;
  return { userId, expiresAtMs: exp };
}

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

/** Cookie descriptor for responses that must set the cookie explicitly (OAuth redirect). */
export function buildSessionCookie(userId: string): {
  name: string;
  value: string;
  options: { httpOnly: boolean; sameSite: "lax"; secure: boolean; path: string; maxAge: number };
} {
  return {
    name: COOKIE_NAME,
    value: createToken(userId),
    options: { httpOnly: true, sameSite: "lax", secure: isProd, path: "/", maxAge: MAX_AGE_SEC },
  };
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  // Clear both names so stale dev cookies never linger into prod and vice versa.
  for (const name of new Set([COOKIE_NAME, "soma_session", "__Secure-soma_session"])) {
    store.set(name, "", { httpOnly: true, path: "/", maxAge: 0, secure: isProd, sameSite: "lax" });
  }
}

export async function getSessionUser(): Promise<SessionUserWithAdmin | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const verified = verifyToken(token);
  if (!verified) return null;
  const user = await db.user.findUnique({ where: { id: verified.userId } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    department: user.department,
    yearOfStudy: user.yearOfStudy,
    driveConnected: user.driveConnected,
    driveEmail: user.driveEmail,
    isAdmin: isAdminEmail(user.email),
  };
}

/** Sign-in is restricted to Kenyatta University student emails. */
export function isValidStudentEmail(email: string): boolean {
  return /^[^\s@]+@ku\.ac\.ke$/i.test(email.trim().toLowerCase());
}

/**
 * Consistent public user payload returned by sign-in / sign-up / me
 * endpoints (single source of truth so the shapes never drift).
 */
export function publicUserPayload(user: {
  id: string;
  email: string;
  name: string;
  department: string;
  yearOfStudy: string;
  driveConnected: boolean;
  driveEmail: string | null;
}): SessionUserWithAdmin {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    department: user.department,
    yearOfStudy: user.yearOfStudy,
    driveConnected: user.driveConnected,
    driveEmail: user.driveEmail,
    isAdmin: isAdminEmail(user.email),
  };
}
