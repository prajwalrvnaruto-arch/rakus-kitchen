import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";

/**
 * Razorpay integration — server-only. RAZORPAY_KEY_SECRET and
 * RAZORPAY_WEBHOOK_SECRET must never reach the browser (no NEXT_PUBLIC_
 * prefix); only RAZORPAY_KEY_ID is mirrored to a public var for Checkout.js.
 */

let client: Razorpay | null = null;
function getClient(): Razorpay {
  if (client) return client;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Razorpay not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
  client = new Razorpay({ key_id, key_secret });
  return client;
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
}

/** Creates a Razorpay order for an amount already computed server-side (paise). */
export async function createRazorpayOrder(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const order = await getClient().orders.create({
    amount: params.amountPaise,
    currency: "INR",
    receipt: params.receipt,
    notes: params.notes,
  });
  return { id: order.id, amount: Number(order.amount), currency: order.currency };
}

/** Fetches a payment's live status/amount from Razorpay — used as a second check
 *  beyond the signature, so a forged-but-signed payload (impossible in practice,
 *  but cheap insurance) can't slip through with a mismatched amount. */
export async function fetchRazorpayPayment(paymentId: string) {
  return getClient().payments.fetch(paymentId);
}

/**
 * Verifies the signature Razorpay Checkout returns to the browser after a
 * successful payment: HMAC-SHA256("<order_id>|<payment_id>", key_secret).
 * Uses a timing-safe comparison — plain `===` on a hex-digest signature is a
 * (small but real) timing side-channel.
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET not configured");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return timingSafeEqualHex(expected, params.signature);
}

/**
 * Verifies a Razorpay webhook's signature against the RAW request body.
 * Must be called with the body exactly as received — parsing it to JSON
 * first (even round-tripped back to a string) can change byte-for-byte
 * formatting and silently break every signature check.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET not configured");
  if (!signatureHeader) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqualHex(expected, signatureHeader);
}

function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(actualHex, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}
