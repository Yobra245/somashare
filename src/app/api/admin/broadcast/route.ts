import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sendBulk, broadcastEmail, mailerConfigured } from "@/lib/mailer";
import { escapeHtml } from "@/lib/validate";

/**
 * POST /api/admin/broadcast { subject, body }
 * Sends an update to the active mailing list via Resend.
 * Without RESEND_API_KEY the request fails with a hint to export the CSV
 * instead — so the UI can point the owner at the manual path.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  if (!mailerConfigured()) {
    return NextResponse.json(
      {
        error:
          "RESEND_API_KEY is not configured. Export the CSV (mail-merge from your inbox) or add the key to send in-app.",
      },
      { status: 501 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { subject?: string; body?: string };
  const subject = (body.subject ?? "").trim().slice(0, 200);
  const text = (body.body ?? "").trim().slice(0, 10_000);
  if (!subject || !text) {
    return NextResponse.json({ error: "Subject and body are required." }, { status: 400 });
  }

  const recipients = await db.subscriber.findMany({
    where: { active: true },
    select: { email: true, name: true },
  });
  if (recipients.length === 0) {
    return NextResponse.json({ error: "Nobody has signed up yet." }, { status: 400 });
  }

  const html = broadcastEmail(
    text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`).join("")
  );

  const result = await sendBulk(
    recipients,
    subject,
    () => html // same body for everyone; Resend handles delivery
  );

  return NextResponse.json({ ...result, recipients: recipients.length });
}
