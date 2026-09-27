/**
 * Password hashing for SomaShare email+password accounts.
 *
 * Uses Node's built-in scrypt (memory-hard KDF — the recommended choice
 * when bcrypt/argon2 native modules are undesirable). Zero new deps.
 *
 * Stored format (single string in User.passwordHash):
 *   scrypt$N${N}$r${r}$p${p}$<saltHex>$<hashHex>
 *
 * Parameters are embedded so they can be strengthened later without
 * invalidating existing hashes (verify re-reads them; a future
 * "rehash on login" step can upgrade weak/old params transparently).
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** OWASP-recommended scrypt parameters (64MB max memory). */
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LEN = 64;
const MAXMEM = 128 * PARAMS.N * PARAMS.r * 2; // headroom so scrypt never hits its 32MB default cap

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Hash a plaintext password. Never throws for valid input; returns null for invalid input. */
export async function hashPassword(password: string): Promise<string | null> {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return null;
  }
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, { ...PARAMS, maxmem: MAXMEM });
  return `scrypt$N${PARAMS.N}$r${PARAMS.r}$p${PARAMS.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored hash.
 * Constant-time comparison; returns false for malformed/legacy values.
 */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || typeof password !== "string" || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }
  const parts = stored.split("$");
  // ["scrypt", "N16384", "r8", "p1", salt, hash]
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const parseParam = (raw: string | undefined, prefix: string): number => {
    if (!raw?.startsWith(prefix)) return NaN;
    return Number.parseInt(raw.slice(prefix.length), 10);
  };
  const N = parseParam(parts[1], "N");
  const r = parseParam(parts[2], "r");
  const p = parseParam(parts[3], "p");
  const salt = Buffer.from(parts[4] ?? "", "hex");
  const expected = Buffer.from(parts[5] ?? "", "hex");
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  if (salt.length < 8 || expected.length !== KEY_LEN) return false;

  const actual = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, { N, r, p, maxmem: MAXMEM });
  return timingSafeEqual(actual, expected);
}
