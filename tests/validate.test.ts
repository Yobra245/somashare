import { describe, expect, it } from "vitest";
import { sanitizeFileName, isPdfBytes, isValidListEmail, escapeHtml } from "@/lib/validate";

describe("sanitizeFileName", () => {
  it("keeps normal names intact", () => {
    expect(sanitizeFileName("eet 300 past paper 2024.pdf")).toBe("eet 300 past paper 2024.pdf");
  });

  it("strips path traversal components", () => {
    expect(sanitizeFileName("../../../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\evil\\notes.pdf")).toBe("notes.pdf");
    expect(sanitizeFileName("..\\..\\file.pdf")).toBe("file.pdf");
  });

  it("removes quotes and control characters (header injection)", () => {
    const out = sanitizeFileName('notes"\r\nX-Injected: 1.pdf');
    expect(out).not.toContain('"');
    expect(out).not.toContain("\r");
    expect(out).not.toContain("\n");
  });

  it("caps length at 120 chars", () => {
    const out = sanitizeFileName("a".repeat(500) + ".pdf");
    expect(out.length).toBeLessThanOrEqual(125);
  });

  it("falls back when everything is stripped", () => {
    expect(sanitizeFileName("///")).toBe("document");
    expect(sanitizeFileName("///", "paper")).toBe("paper");
  });
});

describe("isPdfBytes", () => {
  it("accepts a real PDF header", () => {
    expect(isPdfBytes(Buffer.from("%PDF-1.7\n..."))).toBe(true);
  });

  it("accepts PDFs with junk before the header", () => {
    const junk = Buffer.concat([Buffer.alloc(50, 32), Buffer.from("%PDF-1.4")]);
    expect(isPdfBytes(junk)).toBe(true);
  });

  it("rejects executables, html and text", () => {
    expect(isPdfBytes(Buffer.from("MZ\x90\x00\x03"))).toBe(false);
    expect(isPdfBytes(Buffer.from("<!DOCTYPE html><html>"))).toBe(false);
    expect(isPdfBytes(Buffer.from("SomaShare vault entry"))).toBe(false);
    expect(isPdfBytes(Buffer.alloc(0))).toBe(false);
  });
});

describe("isValidListEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidListEmail("student@gmail.com")).toBe(true);
    expect(isValidListEmail("first.last+tag@sub.domain.ac.ke")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(isValidListEmail("nope")).toBe(false);
    expect(isValidListEmail("a@b")).toBe(false);
    expect(isValidListEmail("")).toBe(false);
    expect(isValidListEmail(`${"x".repeat(200)}@gmail.com`)).toBe(false);
  });
});

describe("escapeHtml", () => {
  it("neutralizes script injection", () => {
    const out = escapeHtml('<script>alert("x")</script>');
    expect(out).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });
});
