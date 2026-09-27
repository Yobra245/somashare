/**
 * Minimal fixed-window in-memory rate limiter.
 *
 * Effective for a single server instance. On serverless (Vercel) each
 * lambda has its own memory, so limits are best-effort there — still
 * enough to blunt naive abuse. Pair with platform-level limits
 * (Vercel WAF / firewall rules) for hard guarantees.
 */

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

/** Periodically drop expired buckets so the map never grows unbounded. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, win] of buckets) {
    if (win.resetAt <= now) buckets.delete(key);
  }
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Consume one unit from the bucket identified by `key`.
 * Returns ok=false once `max` requests were made inside `windowMs`.
 */
export function rateLimit(key: string, max: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);

  const win = buckets.get(key);
  if (!win || win.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, retryAfterSec: 0 };
  }
  if (win.count >= max) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((win.resetAt - now) / 1000) };
  }
  win.count += 1;
  return { ok: true, remaining: max - win.count, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Pre-canned limiters used across the API. */
export const limits = {
  /** Mailing-list signups: 5 per IP per hour. */
  subscribe: (req: Request) => rateLimit(`sub:${clientIp(req)}`, 5, 60 * 60 * 1000),
  /** Account sign-ups: 5 per IP per hour (stricter — creates credentials). */
  signup: (req: Request) => rateLimit(`signup:${clientIp(req)}`, 5, 60 * 60 * 1000),
  /** Password sign-in attempts: 10 per IP per 10 minutes (brute-force blunt). */
  passwordSignin: (req: Request) => rateLimit(`psign:${clientIp(req)}`, 10, 10 * 60 * 1000),
  /** Resource uploads: 10 per user per hour. */
  upload: (userId: string) => rateLimit(`up:${userId}`, 10, 60 * 60 * 1000),
  /** Downloads: 60 per user per minute (also covers scraping bursts). */
  download: (userId: string) => rateLimit(`dl:${userId}`, 60, 60 * 1000),
  /** Dev-only demo sign-ins: 10 per IP per 10 minutes. */
  demoSignin: (req: Request) => rateLimit(`demo:${clientIp(req)}`, 10, 10 * 60 * 1000),
} as const;
