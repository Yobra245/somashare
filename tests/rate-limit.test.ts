import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows up to the max inside the window", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k1", 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit("k1", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    for (let i = 0; i < 2; i++) rateLimit("k2", 2, 5_000);
    expect(rateLimit("k2", 2, 5_000).ok).toBe(false);

    vi.advanceTimersByTime(6_000);
    expect(rateLimit("k2", 2, 5_000).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    expect(rateLimit("a", 1, 60_000).ok).toBe(true);
    expect(rateLimit("a", 1, 60_000).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000).ok).toBe(true);
  });
});
