/**
 * ── PHONE NORMALIZATION — SINGLE SOURCE OF TRUTH ─────────────────────────
 * Orders store phones in loose human form ("+91 96068 88096", "9606888096",
 * "919606888096"). Different consumers need different shapes:
 *   • WhatsApp wa.me links want the international form "919606888096".
 *   • Porter's "Receiver's Mobile" field wants the bare 10 digits "9606888096".
 *   • Borzo carrier payloads want a clean 10-digit contact.
 *
 * Every one of those derives from a single canonical 10-digit Indian mobile.
 * This module resolves that once and fails LOUDLY (returns null) for anything
 * that isn't a valid Indian mobile, so a malformed number surfaces as an empty
 * link the caller can guard — never as a silently-truncated wrong number.
 *
 * Kept dependency-free so client and server code can both import it.
 */

/** Indian mobile numbers are exactly 10 digits and start 6, 7, 8, or 9. */
const INDIAN_MOBILE_10 = /^[6-9]\d{9}$/;

export interface NormalizedPhone {
  /** Canonical bare 10-digit mobile ("9606888096"), or null if unresolvable. */
  digits10: string | null;
}

/**
 * Resolves any loosely-formatted Indian mobile to its canonical 10 digits.
 * Strips non-digits, peels a leading country code ("91" / "091" / "0"),
 * then validates the 10-digit result. Returns { digits10: null } for anything
 * that can't be resolved to a valid Indian mobile — the caller decides how to
 * present that (empty link, placeholder, error) rather than being handed a
 * plausibly-wrong number.
 */
export function normalizeIndianMobile(raw: string | undefined | null): NormalizedPhone {
  if (!raw) return { digits10: null };
  let digits = raw.replace(/\D/g, "");

  // Peel a country/trunk prefix only when doing so leaves exactly 10 digits,
  // so a legitimate 10-digit number is never shortened.
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 13 && digits.startsWith("091")) digits = digits.slice(3);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  return { digits10: INDIAN_MOBILE_10.test(digits) ? digits : null };
}

/** International form for wa.me ("919606888096"), or empty string if unresolvable. */
export function toWaIntl(raw: string | undefined | null): string {
  const { digits10 } = normalizeIndianMobile(raw);
  return digits10 ? `91${digits10}` : "";
}

/** Bare 10-digit form for carrier / Porter fields, or empty string if unresolvable. */
export function toLocal10(raw: string | undefined | null): string {
  const { digits10 } = normalizeIndianMobile(raw);
  return digits10 ?? "";
}
