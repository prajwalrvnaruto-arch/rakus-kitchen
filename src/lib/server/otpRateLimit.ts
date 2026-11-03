import "server-only";
import { NextResponse } from "next/server";

/**
 * Lightweight in-memory rate limit for the OTP auth routes (send-otp, verify-otp).
 *
 * phoneAuth.ts already rate-limits per PHONE NUMBER (60s cooldown + 5/hour quota),
 * but that does nothing to stop a single caller from hammering the route with a
 * different phone number on every request (quota-drain against Fast2SMS billing)
 * or brute-forcing verify-otp's 6-digit code across many phone numbers at once.
 * This adds a per-IP sliding-window throttle at the route level, mirroring
 * src/lib/server/mapsRateLimit.ts's architecture: in-memory, best-effort per
 * serverless instance, cheap, and layered on top of (not replacing) the
 * per-phone-number limiter inside phoneAuth.ts.
 *
 * send-otp is capped tighter than verify-otp since each allowed call sends a
 * real, billable SMS; verify-otp has a slightly higher ceiling since a genuine
 * user may legitimately mistype a code a few times in a row.
 */

const WINDOW_MS = 60_000;
const MAX_SEND_PER_WINDOW = 8; // generous for retries across a few numbers on one connection; brutal for a scripted SMS-bomb
const MAX_VERIFY_PER_WINDOW = 15; // allows a few mistyped codes without blocking a real user

const sendHits = new Map<string, number[]>();
const verifyHits = new Map<string, number[]>();

/** Best-effort client IP from the standard proxy headers Vercel sets. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function check(hits: Map<string, number[]>, key: string, maxPerWindow: number): NextResponse | null {
  const now = Date.now();
  const prior = hits.get(key) ?? [];
  const windowStart = now - WINDOW_MS;
  const recent = prior.filter((t) => t > windowStart);

  if (recent.length >= maxPerWindow) {
    const oldest = Math.min(...recent);
    const retryAfter = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  recent.push(now);
  hits.set(key, recent);
  // Opportunistic cleanup so the map doesn't grow unbounded under many keys.
  if (hits.size > 5000) {
    hits.forEach((v, k) => {
      if (v.every((t) => t <= windowStart)) hits.delete(k);
    });
  }
  return null;
}

/** Returns a 429 NextResponse if this IP is over the send-otp window, else null. */
export function checkSendOtpRateLimit(key: string): NextResponse | null {
  return check(sendHits, key, MAX_SEND_PER_WINDOW);
}

/** Returns a 429 NextResponse if this IP is over the verify-otp window, else null. */
export function checkVerifyOtpRateLimit(key: string): NextResponse | null {
  return check(verifyHits, key, MAX_VERIFY_PER_WINDOW);
}
