/**
 * Lightweight session auth for SomaShare.
 *
 * Issues an HMAC-signed, httpOnly cookie after a valid @ku.ac.ke
 * student email sign-in. No third-party provider needed — the launch
 * restriction is the university email domain itself.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

const COOKIE_NAME = "soma_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const SECRET = process.env.SESSION_SECRET ?? "somashare-dev-secret-change-in-production";
export const STUDENT_EMAIL_DOMAIN = "@ku.ac.ke";

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

export function createToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function verifyToken(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = Buffer.from(sign(userId));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length) return null;
  return timingSafeEqual(expected, actual) ? userId : null;
}

export function isValidStudentEmail(email: string): boolean {
  return /^[^\s@]+@ku\.ac\.ke$/i.test(email.trim().toLowerCase());
}

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // sandbox runs behind a proxy without TLS termination info
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = verifyToken(token);
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    department: user.department,
    yearOfStudy: user.yearOfStudy,
    driveConnected: user.driveConnected,
    driveEmail: user.driveEmail,
  };
}
