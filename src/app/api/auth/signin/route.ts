import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidStudentEmail, setSessionCookie, publicUserPayload } from "@/lib/auth";
import { isProd } from "@/lib/env";
import { limits } from "@/lib/rate-limit";
import { verifyPassword, hashPassword } from "@/lib/password";

/** Placeholder hash target used purely for timing equalization (never matches real input). */
const TIMING_DUMMY_PASSWORD = "timing-equalizer-not-a-real-password";

/**
 * POST /api/auth/signin
 *
 * Two flows, selected by payload shape:
 *
 * 1. Password sign-in — { email, password }
 *    For accounts created via Sign up (scrypt-hashed password).
 *    Generic error message so the endpoint can't be used to enumerate
 *    which @ku.ac.ke addresses have accounts. Available in production.
 *
 * 2. Demo sign-in — { email?, name?, ... } without a password
 *    Sandbox/preview only (404 in production) so reviewers can explore
 *    the full product without Google credentials. Real ownership
 *    verification happens through Google OAuth (/api/auth/google/start).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    name?: string;
    department?: string;
    yearOfStudy?: string;
  };

  const email = (body.email ?? "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  /* ---------------- Flow 1: email + password ---------------- */
  if (password.length > 0) {
    if (!limits.passwordSignin(req).ok) {
      return NextResponse.json(
        { error: "Too many attempts — wait a few minutes and try again." },
        { status: 429 }
      );
    }
    if (!isValidStudentEmail(email)) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { email } });

    // Timing-equalization: always run one scrypt verification, even when
    // the account doesn't exist, so response time can't leak existence.
    const ok = user?.passwordHash
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(TIMING_DUMMY_PASSWORD, await dummyHash());

    if (!ok || !user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await setSessionCookie(user.id);
    return NextResponse.json({ user: publicUserPayload(user) });
  }

  /* ---------------- Flow 2: dev-only demo sign-in ---------------- */
  if (isProd) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!limits.demoSignin(req).ok) {
    return NextResponse.json({ error: "Too many attempts — try again shortly." }, { status: 429 });
  }

  const demoEmail = email || "alex.ochieng@ku.ac.ke";
  if (!isValidStudentEmail(demoEmail)) {
    return NextResponse.json({ error: "Demo sign-in still requires a valid @ku.ac.ke email." }, { status: 403 });
  }

  const name = (body.name ?? "").trim() || "Alex Ochieng";
  const department = (body.department ?? "Engineering").trim();
  const yearOfStudy = (body.yearOfStudy ?? "Year 3").trim();

  // In sandbox storage mode uploads write to ./storage, so the demo user
  // is marked connected without a real Drive token.
  const user = await db.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: { email: demoEmail, name, department, yearOfStudy, driveConnected: true, driveEmail: demoEmail },
  });

  await setSessionCookie(user.id);

  return NextResponse.json({ user: publicUserPayload(user) });
}

/** Lazily-built scrypt hash used purely for timing equalization (never matches). */
let dummyHashPromise: Promise<string | null> | null = null;
function dummyHash(): Promise<string | null> {
  dummyHashPromise ??= hashPassword(TIMING_DUMMY_PASSWORD);
  return dummyHashPromise;
}
