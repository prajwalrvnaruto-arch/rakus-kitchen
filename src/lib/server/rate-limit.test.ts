import { describe, it, expect } from "vitest";
import { decideRateLimit, MAX_ORDERS_PER_WINDOW, RATE_LIMIT_WINDOW_MS } from "../rate-limit-policy";

const NOW = 1_700_000_000_000;

describe("decideRateLimit (M3 — order-creation throttle)", () => {
  it("allows an attempt when there is no prior history", () => {
    const d = decideRateLimit([], NOW);
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.attempts).toEqual([NOW]);
  });

  it("allows up to the cap within the window and appends each attempt", () => {
    // (MAX - 1) prior attempts inside the window → the next one is still allowed.
    const prior = Array.from({ length: MAX_ORDERS_PER_WINDOW - 1 }, (_, i) => NOW - i * 1000);
    const d = decideRateLimit(prior, NOW);
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.attempts).toHaveLength(MAX_ORDERS_PER_WINDOW);
  });

  it("blocks once the cap is reached and reports a positive retry delay", () => {
    const prior = Array.from({ length: MAX_ORDERS_PER_WINDOW }, (_, i) => NOW - i * 1000);
    const d = decideRateLimit(prior, NOW);
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.retryAfterSeconds).toBeGreaterThan(0);
      expect(d.retryAfterSeconds).toBeLessThanOrEqual(RATE_LIMIT_WINDOW_MS / 1000);
    }
  });

  it("prunes attempts older than the window so they don't count", () => {
    // MAX attempts, but all of them are just outside the window → allowed again.
    const stale = Array.from(
      { length: MAX_ORDERS_PER_WINDOW },
      (_, i) => NOW - RATE_LIMIT_WINDOW_MS - 1000 - i,
    );
    const d = decideRateLimit(stale, NOW);
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.attempts).toEqual([NOW]); // stale ones dropped
  });
});
