import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { limits } from "@/lib/rate-limit";
import { isValidListEmail } from "@/lib/validate";
import { sendEmail, welcomeEmail } from "@/lib/mailer";
import { appUrl } from "@/lib/env";

/**
 * POST /api/subscribe — join the SomaShare mailing list.
 * Body: { name?, email }
 * Used by the "Join the community" page: the owner follows up with new
 * members, sends welcome notes and occasional updates.
 */
export async function POST(req: Request) {
  if (!limits.subscribe(req).ok) {
    return NextResponse.json({ error: "Too many signups from this network — try again later." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { name?: string; email?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim().slice(0, 80) || "Friend";

  if (!isValidListEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  let created = false;
  try {
    const existing = await db.subscriber.findUnique({ where: { email } });
    if (existing) {
      if (!existing.active) {
        await db.subscriber.update({ where: { id: existing.id }, data: { active: true, name } });
        created = true; // resubscribe → say welcome again
      }
    } else {
      await db.subscriber.create({ data: { email, name } });
      created = true;
    }
  } catch (err) {
    console.error("subscribe error", err);
    return NextResponse.json({ error: "Could not save your signup — please try again." }, { status: 500 });
  }

  if (created) {
    const html = welcomeEmail(name).replace("{{APP_URL}}", appUrl());
    void sendEmail({ to: email, subject: "Karibu to SomaShare 🎓", html }).catch(() => undefined);
  }

  // Same response either way — the list is not an enumeration oracle.
  return NextResponse.json({ ok: true }, { status: created ? 201 : 200 });
}
