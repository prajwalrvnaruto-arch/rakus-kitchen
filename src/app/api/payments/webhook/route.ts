import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/server/razorpay";
import { finalizePayment, claimWebhookEvent, markIntentFailed, PaymentFinalizeError } from "@/lib/server/paymentIntents";

export const runtime = "nodejs";

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity?: {
        id: string;
        order_id: string;
        amount: number;
        status: string;
      };
    };
  };
}

/**
 * Server-to-server reliability backstop. Configure this URL as a webhook in
 * the Razorpay dashboard (Settings → Webhooks) for at least `payment.captured`
 * and `payment.failed`, with its own secret in RAZORPAY_WEBHOOK_SECRET
 * (deliberately separate from RAZORPAY_KEY_SECRET — a leaked webhook secret
 * shouldn't also expose the API secret).
 *
 * Reads the RAW body via request.text() and verifies BEFORE any JSON.parse —
 * Razorpay signs the exact bytes it sent, and re-serializing a parsed object
 * is not guaranteed to reproduce them byte-for-byte.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("webhook: signature verification failed");
    // 400, not 401 — this endpoint has no concept of "the caller's identity",
    // only "is this really from Razorpay". Razorpay retries on non-2xx.
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const entity = payload.payload?.payment?.entity;
  if (!entity) {
    // Some webhook events (e.g. refund events) carry no payment entity —
    // acknowledge so Razorpay stops retrying, there's nothing for us to do.
    return NextResponse.json({ ok: true });
  }

  // Dedupe key: Razorpay can and does redeliver the same event. Keying on
  // (event type, payment id) rather than trusting a header lets a retried
  // delivery become a guaranteed no-op even without an explicit event id.
  const isNew = await claimWebhookEvent(`${payload.event}:${entity.id}`);
  if (!isNew) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  try {
    if (payload.event === "payment.captured") {
      await finalizePayment({
        razorpayOrderId: entity.order_id,
        razorpayPaymentId: entity.id,
        expectedAmountPaise: entity.amount,
        // No callerUid here — the webhook has no signed-in user, and doesn't
        // need one: the payment's own signature is the authority.
      });
    } else if (payload.event === "payment.failed") {
      await markIntentFailed(entity.order_id, "Payment failed (webhook)");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("webhook finalize error:", err);
    // A not_found here usually just means create-order's intent write and
    // this webhook race — Razorpay will retry, and by then the intent will
    // exist. Any other error: return 500 so Razorpay retries too.
    if (err instanceof PaymentFinalizeError && err.code === "not_found") {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
