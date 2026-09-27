/**
 * Google OAuth 2.0 for SomaShare.
 *
 * ONE consent flow powers both halves of the product:
 *  1. Identity — sign in restricted to @ku.ac.ke student accounts.
 *  2. Storage — the drive.file scope, so every student contributes
 *     space from their own Google Drive (the BYO-storage model).
 *
 * Scope choice notes:
 *  - openid email profile → basic scopes, no Google verification needed.
 *  - https://www.googleapis.com/auth/drive.file → RESTRICTED scope; lets
 *    the app see ONLY files it created. Students see exactly what they
 *    approve. See README ("Google Cloud setup") for the verification
 *    and testing-mode caveats.
 *
 * `access_type=offline&prompt=consent` gives us a refresh token we can
 * use later to upload/read that student's files (encrypted at rest —
 * see lib/crypto.ts).
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

export function oauthConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function googleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline", // need a refresh token for later uploads
    prompt: "consent", // force refresh token reissue on repeat visits
    include_granted_scopes: "true",
    hd: "ku.ac.ke", // hint: pick the KU workspace account (server-side check is authoritative)
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokens {
  accessToken: string;
  expiresInSec: number;
  refreshToken: string | null; // null when Google re-issues nothing (already consented earlier without offline)
  idToken: string | null;
  scope: string; // granted scopes — check for drive.file before storing the token
}

export async function exchangeCode(code: string, redirectUri: string): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
  };
  return {
    accessToken: json.access_token,
    expiresInSec: json.expires_in ?? 3600,
    refreshToken: json.refresh_token ?? null,
    idToken: json.id_token ?? null,
    scope: json.scope ?? "",
  };
}

export interface GoogleUserInfo {
  email: string;
  name: string;
  emailVerified: boolean;
}

export async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo failed (${res.status})`);
  const json = (await res.json()) as { email?: string; name?: string; email_verified?: boolean };
  if (!json.email) throw new Error("Google account has no email address");
  return {
    email: json.email.toLowerCase(),
    name: json.name?.trim() || json.email.split("@")[0]!,
    emailVerified: json.email_verified ?? false,
  };
}

/** Exchange a refresh token for a short-lived access token. */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresInSec: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresInSec: json.expires_in ?? 3600 };
}

/** Best-effort revoke (used on disconnect so students keep control). */
export async function revokeToken(refreshToken: string): Promise<void> {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    });
  } catch {
    /* best-effort */
  }
}
