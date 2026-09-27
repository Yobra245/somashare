import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkProductionEnv, googleOAuthConfigured, isProd } from "@/lib/env";
import { isSandboxStorage } from "@/lib/storage";
import { mailerConfigured } from "@/lib/mailer";

const BOOT_TIME = Date.now();

/**
 * GET /api/health — deployment + monitoring probe.
 * Reports config problems in production (missing SESSION_SECRET etc.)
 * so misconfiguration is visible immediately, not via weird bugs later.
 */
export async function GET() {
  let dbOk = true;
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }

  const env = checkProductionEnv();
  const body = {
    ok: dbOk && env.ok,
    uptimeSec: Math.round((Date.now() - BOOT_TIME) / 1000),
    checks: {
      db: dbOk ? "up" : "down",
      env: env.ok ? "ok" : env.problems,
      oauth: googleOAuthConfigured() ? "configured" : isProd ? "MISSING" : "sandbox-demo",
      storage: isSandboxStorage() ? "sandbox-drive" : "per-user-google-drive",
      mailer: mailerConfigured() ? "resend" : "dry-run",
    },
  };

  return NextResponse.json(body, { status: body.ok ? 200 : 503 });
}
