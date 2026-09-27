/**
 * Environment validation for SomaShare.
 *
 * Fails fast in production when required configuration is missing —
 * better a crash at boot than silently running with a public fallback
 * secret (the #1 way session auth gets bypassed).
 */

export const isProd = process.env.NODE_ENV === "production";

/** Admin emails (comma-separated env var, lowercased). */
export const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter((e) => e.length > 0 && e.includes("@"));

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * The session secret. In production it MUST be provided via env and be
 * at least 32 chars — no fallback (the old hardcoded dev secret is a
 * known value on GitHub and would let anyone forge sessions).
 */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (isProd) {
    if (!secret || secret.length < 32) {
      throw new Error(
        "SESSION_SECRET must be set to a random 32+ character string in production. Generate one with: openssl rand -hex 32"
      );
    }
    return secret;
  }
  // Development: warn loudly but keep the sandbox usable.
  if (!secret) {
    return "somashare-dev-secret-change-in-production";
  }
  return secret;
}

/** Throws in production if required OAuth configuration is missing. */
export function checkProductionEnv(): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (isProd) {
    try {
      sessionSecret();
    } catch (e) {
      problems.push(e instanceof Error ? e.message : "SESSION_SECRET invalid");
    }
    if (!process.env.DATABASE_URL?.startsWith("postgres")) {
      problems.push("DATABASE_URL must be a postgres:// connection string on Vercel");
    }
  }
  return { ok: problems.length === 0, problems };
}

/** Is real Google OAuth configured? (Sign-in + Drive both depend on it.) */
export function googleOAuthConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

/** The absolute base URL of the app (used for OAuth redirect URIs). */
export function appUrl(): string {
  return (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
