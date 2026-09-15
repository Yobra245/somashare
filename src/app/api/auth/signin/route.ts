import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  isValidStudentEmail,
  setSessionCookie,
  clearSessionCookie,
  STUDENT_EMAIL_DOMAIN,
} from "@/lib/auth";

/**
 * POST /api/auth/signin
 * Body: { email, name?, department?, yearOfStudy? }
 * Launch restriction: only valid @ku.ac.ke student emails may pass.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      name?: string;
      department?: string;
      yearOfStudy?: string;
    };

    const email = (body.email ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Student email is required." }, { status: 400 });
    }
    if (!isValidStudentEmail(email)) {
      return NextResponse.json(
        { error: `Launch restriction: sign in with your valid ${STUDENT_EMAIL_DOMAIN} student email.` },
        { status: 403 }
      );
    }

    const name = (body.name ?? "").trim() || deriveNameFromEmail(email);
    const department = (body.department ?? "Engineering").trim();
    const yearOfStudy = (body.yearOfStudy ?? "Year 3").trim();

    const user = await db.user.upsert({
      where: { email },
      update: { name, department, yearOfStudy },
      create: { email, name, department, yearOfStudy },
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
      },
    });
  } catch (err) {
    console.error("signin error", err);
    return NextResponse.json({ error: "Sign-in failed. Please try again." }, { status: 500 });
  }
}

/** DELETE /api/auth/signout (same handler via POST override below) */
export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}

function deriveNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
