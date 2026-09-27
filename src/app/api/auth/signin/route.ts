import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidStudentEmail, setSessionCookie } from "@/lib/auth";
import { isProd, isAdminEmail } from "@/lib/env";
import { limits } from "@/lib/rate-limit";

/**
 * POST /api/auth/signin — DEMO SIGN-IN, development only.
 *
 * Real sign-in goes through Google OAuth (/api/auth/google/start), which
 * verifies ownership of the @ku.ac.ke account. This endpoint exists so
 * the sandbox/preview can be explored without Google credentials; in
 * production it returns 404.
 */
export async function POST(req: Request) {
  if (isProd) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!limits.demoSignin(req).ok) {
    return NextResponse.json({ error: "Too many attempts — try again shortly." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    department?: string;
    yearOfStudy?: string;
  };

  const email = (body.email ?? "alex.ochieng@ku.ac.ke").trim().toLowerCase();
  if (!isValidStudentEmail(email)) {
    return NextResponse.json({ error: "Demo sign-in still requires a valid @ku.ac.ke email." }, { status: 403 });
  }

  const name = (body.name ?? "").trim() || "Alex Ochieng";
  const department = (body.department ?? "Engineering").trim();
  const yearOfStudy = (body.yearOfStudy ?? "Year 3").trim();

  // In sandbox storage mode uploads write to ./storage, so the demo user
  // is marked connected without a real Drive token.
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name, department, yearOfStudy, driveConnected: true, driveEmail: email },
  });

  await setSessionCookie(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      department: user.department,
      yearOfStudy: user.yearOfStudy,
      driveConnected: user.driveConnected,
      driveEmail: user.driveEmail,
      isAdmin: isAdminEmail(user.email),
    },
  });
}
