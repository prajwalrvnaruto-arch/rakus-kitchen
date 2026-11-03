/**
 * Pure order-creation rate-limit policy — the window/cap decision with no I/O,
 * kept dependency-free (no "server-only", no admin SDK) so it can be unit
 * tested and reused. The Firestore transaction that persists the result lives
 * in src/lib/server/paymentIntents.ts (enforceOrderRateLimit), which wraps this.
 *
 * A double-click is already caught on the client and duplicate orders are
 * impossible (finalizePayment is idempotent), but nothing stopped a scripted
 * client from spraying create-order calls — each spawns a Razorpay order + an
 * inert intent, real API/log/storage cost at volume. This caps one customer to
 * MAX_ORDERS_PER_WINDOW attempts per rolling window.
 */
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const MAX_ORDERS_PER_WINDOW = 5;

export type RateLimitDecision =
  | { allowed: true; attempts: number[] }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Given the prior attempt timestamps (epoch ms) and "now", prunes attempts
 * outside the rolling window and either returns the list to persist (with
 * `now` appended) or how many seconds to wait before the window frees up.
 */
export function decideRateLimit(priorAttempts: number[], now: number): RateLimitDecision {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = priorAttempts.filter((t) => t > windowStart);

  if (recent.length >= MAX_ORDERS_PER_WINDOW) {
    const oldest = Math.min(...recent);
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, attempts: [...recent, now] };
}
