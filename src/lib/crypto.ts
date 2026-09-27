/**
 * Symmetric encryption for stored Google OAuth refresh tokens.
 *
 * Refresh tokens are long-lived credentials to a student's Drive — they
 * must never sit in the database in plaintext. We encrypt with
 * AES-256-GCM using a key derived from SESSION_SECRET via scrypt.
 *
 * Token format: base64url(iv(12) || authTag(16) || ciphertext)
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { sessionSecret } from "./env";

const SALT = "somashare.drive.tokens.v1";

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (!cachedKey) cachedKey = scryptSync(sessionSecret(), SALT, 32);
  return cachedKey;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function decryptToken(payload: string): string | null {
  try {
    const raw = Buffer.from(payload, "base64url");
    if (raw.length < 12 + 16 + 1) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null; // wrong key or corrupted payload
  }
}
