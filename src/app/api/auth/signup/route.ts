import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidStudentEmail, setSessionCookie, publicUserPayload } from "@/lib/auth";
import { limits } from "@/lib/rate-limit";
import { hashPassword, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "@/lib/password";
import { isValidListEmail } from "@/lib/validate";
import { sendEmail, welcomeEmail } from "@/lib/mailer";
import { appUrl } from "@/lib/env";

/**
 * POST /api/auth/signup — create a student account with email + password.
 *
 * Body: { name, email, password }
 *  - email must be a @ku.ac.ke student address
 *  - password: 8–128 chars (hashed with scrypt — see lib/password.ts)
 *
 * Every new account is also added to the owner's mailing list
 * (Subscriber, source "signup") and receives a welcome email, so new
 * members can be followed up with and emailed occasionally.
 *
 * Google sign-in remains available for accounts that prefer it; such
 * accounts simply have passwordHash = null.
 */
export async function POST(req: Request) {
  if (!limits.signup(req).ok) {
    return NextResponse.json(
      { error: "Too many sign-ups from this network — try again later." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    password?: string;
    department?: string;
    yearOfStudy?: string;
  };

  const name = (body.name ?? "").trim().slice(0, 80);
  const email = (body.email ?? "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (name.length < 2) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }
  if (!isValidListEmail(email) || !isValidStudentEmail(email)) {
    return NextResponse.json(
      { error: "Use your Kenyatta University email — it must end with @ku.ac.ke." },
      { status: 400 }
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  if (!passwordHash) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists — sign in instead." },
        { status: 409 }
      );
    }

    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
        department: (body.department ?? "Engineering").trim().slice(0, 60) || "Engineering",
        yearOfStudy: (body.yearOfStudy ?? "Year 3").trim().slice(0, 20) || "Year 3",
      },
    });

    // Add to the mailing list (or reactivate) so the owner can welcome
    // and follow up. Upsert keeps the list and accounts in sync.
    await db.subscriber.upsert({
      where: { email },
      create: { email, name, source: "signup" },
      update: { active: true, name },
    });

    const html = welcomeEmail(name).replace("{{APP_URL}}", appUrl());
    void sendEmail({ to: email, subject: "Karibu to SomaShare 🎓", html }).catch(() => undefined);

    await setSessionCookie(user.id);

    return NextResponse.json({ user: publicUserPayload(user) }, { status: 201 });
  } catch (err) {
    console.error("signup error", err);
    return NextResponse.json({ error: "Could not create your account — please try again." }, { status: 500 });
  }
}
