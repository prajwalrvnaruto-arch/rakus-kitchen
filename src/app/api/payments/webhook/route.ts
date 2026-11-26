import { NextResponse } from "next/server";
import { verifyCashfreeWebhook, fetchCashfreeOrder } from "@/lib/server/cashfree";
import {
  finalizePayment,
  claimWebhookEvent,
  releaseWebhookEvent,
  markIntentFailed,
  PaymentFinalizeError,
} from "@/lib/server/paymentIntents";

export const runtime = "nodejs";

/** Signed webhooks older (or further in the future) than this are refused,
 *  so a captured delivery can't be replayed later. */
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

function timestampIsFresh(header: string | null): boolean {
  const n = Number(header);
  if (!Number.isFinite(n) || n <= 0) return false;
  const ms = n < 1e12 ? n * 1000 : n; // accept seconds or milliseconds
  return Math.abs(Date.now() - ms) <= MAX_WEBHOOK_AGE_MS;
}

/**
 * Server-to-server reliability backstop. Configure this URL as a webhook in
 * the Cashfree dashboard (Developers → Webhooks) for PAYMENT_SUCCESS_WEBHOOK
 * and PAYMENT_FAILED_WEBHOOK events.
 *
 * Cashfree signs webhooks with HMAC using a secret you set in the dashboard —
 * that secret is stored in CASHFREE_WEBHOOK_SECRET. Verification uses three
 * headers: x-webhook-signature, x-webhook-timestamp, and the raw body bytes.
 *
 * We read the RAW body via request.text() and verify BEFORE any JSON.parse —
 * Cashfree signs the exact bytes, and re-serializing a parsed object is not
 * guaranteed to reproduce them byte-for-byte.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");

  let event;
  try {
    event = verifyCashfreeWebhook(signature, rawBody, timestamp);
  } catch (err) {
    console.warn("cashfree webhook: signature verification failed:", (err as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!timestampIsFresh(timestamp)) {
    console.warn("cashfree webhook: stale or invalid timestamp", timestamp);
    return NextResponse.json({ error: "Stale webhook" }, { status: 400 });
  }

  const eventType = event.type; // e.g. "PAYMENT_SUCCESS_WEBHOOK"
  const payload = event.object;
  const orderData = payload?.data?.order;
  const paymentData = payload?.data?.payment;

  if (!orderData?.order_id || !paymentData?.cf_payment_id) {
    // Some webhook events carry no payment entity — acknowledge so Cashfree
    // stops retrying.
    return NextResponse.json({ ok: true });
  }

  // Dedupe: Cashfree can and does redeliver the same event. Key on
  // (event type + cf_payment_id).
  const eventKey = `${eventType}:${paymentData.cf_payment_id}`;
  const isNew = await claimWebhookEvent(eventKey);
  if (!isNew) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  try {
    if (eventType === "PAYMENT_SUCCESS_WEBHOOK" && paymentData.payment_status === "SUCCESS") {
      // Never trust the payload alone: confirm with Cashfree that the order
      // is really PAID, and charge-check against Cashfree's own amount.
      const cfOrder = await fetchCashfreeOrder(orderData.order_id);
      if (cfOrder.orderStatus !== "PAID") {
        await releaseWebhookEvent(eventKey);
        return NextResponse.json({ error: "Order not paid yet" }, { status: 409 });
      }
      await finalizePayment({
        cashfreeOrderId: orderData.order_id,
        cfPaymentId: paymentData.cf_payment_id,
        expectedAmountRupees: cfOrder.paidAmount ?? paymentData.payment_amount,
        // No callerUid: the webhook has no signed-in user.
      });
    } else if (eventType === "PAYMENT_FAILED_WEBHOOK" || paymentData.payment_status === "FAILED") {
      await markIntentFailed(orderData.order_id, "Payment failed (webhook)");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("cashfree webhook finalize error:", err);
    if (err instanceof PaymentFinalizeError) {
      if (err.code === "not_found") {
        // Intent write and webhook raced: let Cashfree's retry through.
        await releaseWebhookEvent(eventKey);
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      // amount_mismatch / customer_mismatch will never succeed on retry.
      // Record it on the intent for follow-up, and acknowledge so Cashfree
      // stops resending. The error is logged above.
      await markIntentFailed(orderData.order_id, `Webhook rejected: ${err.code}`).catch(() => {});
      return NextResponse.json({ ok: false, error: err.code }, { status: 200 });
    }
    // Transient failure (Firestore, network): retry.
    await releaseWebhookEvent(eventKey);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
