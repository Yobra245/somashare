import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "../src/lib/password";

describe("password hashing (scrypt)", () => {
  it("hashes a valid password into the scrypt$ format", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash).not.toBeNull();
    expect(hash!).toMatch(/^scrypt\$N\d+\$r\d+\$p\d+\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  it("verifies the correct password", async () => {
    const hash = (await hashPassword("correct-horse-battery"))!;
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = (await hashPassword("correct-horse-battery"))!;
    expect(await verifyPassword("wrong-horse", hash)).toBe(false);
  });

  it("produces a unique salt per hash (same password → different hashes)", async () => {
    const a = (await hashPassword("same-password-123"))!;
    const b = (await hashPassword("same-password-123"))!;
    expect(a).not.toEqual(b);
    expect(await verifyPassword("same-password-123", a)).toBe(true);
    expect(await verifyPassword("same-password-123", b)).toBe(true);
  });

  it("rejects passwords shorter than the minimum", async () => {
    expect(await hashPassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBeNull();
    expect(await hashPassword("a".repeat(MIN_PASSWORD_LENGTH))).not.toBeNull();
  });

  it("rejects malformed/legacy stored values without throwing", async () => {
    await expect(verifyPassword("whatever", null)).resolves.toBe(false);
    await expect(verifyPassword("whatever", "")).resolves.toBe(false);
    await expect(verifyPassword("whatever", "bcrypt$abc$def")).resolves.toBe(false);
    await expect(verifyPassword("whatever", "scrypt$N$x$r8$p1$zz$zz")).resolves.toBe(false);
  });

  it("normalizes unicode (NFKC) so visually-equal passwords match", async () => {
    const hash = (await hashPassword("pa\uFB01ssword-123"))!; // 'ﬁ' ligature
    expect(await verifyPassword("pa\uFB01ssword-123".normalize("NFKC"), hash)).toBe(true);
  });
});
