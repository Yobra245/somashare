/**
 * Shared input validation helpers (pure functions — unit-tested).
 */

/** Strip anything risky from a client-supplied filename: path parts, control chars, quotes, unicode tricks. */
export function sanitizeFileName(raw: string, fallback = "document"): string {
  const base = raw.split(/[\\/]/).pop() ?? ""; // drop any path components
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "_") // keep letters/digits/space/dot/dash
    .replace(/\s+/g, " ")
    .replace(/_+/g, "_")
    .trim()
    .slice(0, 120)
    .trim();
  return cleaned || fallback;
}

/** PDF magic number: first bytes are "%PDF-" (allowing a tiny offset for sloppy writers). */
export function isPdfBytes(bytes: Buffer): boolean {
  if (bytes.length < 5) return false;
  const head = bytes.subarray(0, 1024).toString("latin1");
  return head.includes("%PDF-");
}

/** Loose but sane email check for the public mailing list. */
export function isValidListEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && email.length <= 160;
}

/** Escape user text before embedding in HTML emails. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
