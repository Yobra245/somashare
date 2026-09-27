import { describe, expect, it } from "vitest";
import { createToken, verifyToken, isValidStudentEmail } from "@/lib/auth";

describe("session tokens", () => {
  it("round-trips a valid userId", () => {
    const token = createToken("user_123");
    const verified = verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.userId).toBe("user_123");
    expect(verified!.expiresAtMs).toBeGreaterThan(Date.now());
  });

  it("rejects tampered signatures", () => {
    const token = createToken("user_123");
    const forged = token.replace(/^user_123\./, "user_999.");
    expect(verifyToken(forged)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyToken("")).toBeNull();
    expect(verifyToken("no-dots")).toBeNull();
    expect(verifyToken("a.b")).toBeNull();
    expect(verifyToken("a.b.c.d")).toBeNull();
    expect(verifyToken("user.abc.def")).toBeNull(); // exp not numeric
  });

  it("rejects expired tokens", () => {
    // mint a token that expired 1 minute ago
    const expired = createToken("user_123", -60);
    expect(verifyToken(expired)).toBeNull();
  });

  it("always produces the 3-part signed format", () => {
    const token = createToken("user_123");
    expect(token.split(".").length).toBe(3);
  });
});

describe("student email gate", () => {
  it("accepts @ku.ac.ke addresses case-insensitively", () => {
    expect(isValidStudentEmail("alex.ochieng@ku.ac.ke")).toBe(true);
    expect(isValidStudentEmail("Alex@KU.AC.KE")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isValidStudentEmail("alex@gmail.com")).toBe(false);
    expect(isValidStudentEmail("alex@ku.ac.ke.evil.com")).toBe(false);
    expect(isValidStudentEmail("@ku.ac.ke")).toBe(false);
    expect(isValidStudentEmail("")).toBe(false);
  });
});
