/**
 * Mailer — Resend REST adapter + graceful dev fallback.
 *
 * - Set RESEND_API_KEY (and optionally MAIL_FROM) to send real email.
 * - Without a key, emails are logged to the server console instead, so
 *   flows remain testable in dev and the CSV export keeps the list
 *   usable from day one (Gmail mail-merge etc.).
 */

const RESEND_API = "https://api.resend.com/emails";

export function mailerConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function fromAddress(): string {
  return process.env.MAIL_FROM ?? "SomaShare <onboarding@resend.dev>";
}

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendOne(email: OutboundEmail): Promise<{ ok: boolean; error?: string }> {
  if (!mailerConfigured()) {
    console.log(`[mailer:dry] to=${email.to} subject="${email.subject}"`);
    return { ok: true };
  }
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 150)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}

/** Fire-and-forget single email (welcome notes etc.). */
export function sendEmail(email: OutboundEmail): Promise<{ ok: boolean; error?: string }> {
  return sendOne(email);
}

/** Broadcast to the mailing list in polite batches. Returns tallies. */
export async function sendBulk(
  recipients: { email: string; name?: string }[],
  subject: string,
  render: (name?: string) => string
): Promise<{ sent: number; failed: number; dryRun: boolean }> {
  const BATCH = 20;
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((r) => sendOne({ to: r.email, subject, html: render(r.name || undefined) }))
    );
    for (const r of results) {
      if (r.ok) sent++;
      else failed++;
    }
  }
  return { sent, failed, dryRun: !mailerConfigured() };
}

/* ------------------------------------------------------------------ */
/* Templates — plain, warm, on-brand                                   */
/* ------------------------------------------------------------------ */

const WRAP = (title: string, bodyHtml: string) => `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#faf8f2;border-radius:16px;overflow:hidden;border:1px solid #e5e0d3">
  <div style="background:#175334;padding:24px 28px">
    <span style="color:#faf8f2;font-size:22px;font-weight:700">SomaShare 📚</span>
  </div>
  <div style="padding:28px;color:#1b2a21;line-height:1.6">
    <h2 style="margin:0 0 12px;font-size:20px">${title}</h2>
    ${bodyHtml}
    <p style="margin-top:28px;font-size:12px;color:#6e7b72">
      SomaShare — the student-powered learning vault for Kenyatta University.<br/>
      Made for students, by students. Karibu!
    </p>
  </div>
</div>`;

export function welcomeEmail(name?: string): OutboundEmail["html"] {
  const first = name?.split(" ")[0];
  return WRAP(
    `Karibu${first ? `, ${first}` : ""}! 👋`,
    `<p>You're on the SomaShare list — the student-powered vault for notes, past papers and revision slides at Kenyatta University.</p>
     <p>We'll email you occasionally: launch news, new units, and study-season tips. No spam, ever.</p>
     <p style="margin:20px 0">
       <a href="{{APP_URL}}" style="background:#175334;color:#faf8f2;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">Open SomaShare</a>
     </p>
     <p style="font-size:13px;color:#6e7b72">Sign in with your @ku.ac.ke Google account — every upload you share is stored in your own Google Drive, keeping SomaShare free for everyone.</p>`
  );
}

export function broadcastEmail(bodyHtml: string): OutboundEmail["html"] {
  return WRAP("News from the vault", bodyHtml);
}
