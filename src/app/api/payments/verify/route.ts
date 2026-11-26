import { NextResponse } from "next/server";
import { verifyIdToken, AuthTokenError } from "@/lib/server/firebaseAdmin";
import { fetchCashfreeOrder, fetchCashfreePayments } from "@/lib/server/cashfree";
import { finalizePayment, markIntentFailed, PaymentFinalizeError } from "@/lib/server/paymentIntents";

export const runtime = "nodejs";

interface VerifyBody {
  /** Merchant order ID returned from /api/payments/create-order */
  cashfreeOrderId?: string;
}

/**
 * Step 2 of checkout: the browser calls this after Cashfree redirects back to
 * /checkout/confirm?order_id=<id>. We fetch the order status from Cashfree
 * directly (the redirect URL is not signed, so we never trust the query param
 * alone — always re-fetch from the Cashfree API), then materialize the order.
 *
 * Also handles the idempotent fast-path: if the webhook already processed this
 * payment, the intent is already "paid" and we return the existing order.
 */
export async function POST(request: Request) {
  try {
    const { uid } = await verifyIdToken(request.headers.get("authorization"));
    const body = (await request.json()) as VerifyBody;

    if (!body.cashfreeOrderId) {
      return NextResponse.json({ error: "Missing cashfreeOrderId" }, { status: 400 });
    }

    const cashfreeOrderId = body.cashfreeOrderId;
    if (typeof cashfreeOrderId !== "string" || !/^[A-Za-z0-9_-]{1,50}$/.test(cashfreeOrderId)) {
      return NextResponse.json({ error: "Invalid order reference" }, { status: 400 });
    }

    // ─── Idempotent fast-path ────────────────────────────────────────────────
    // If the webhook already processed this payment, intent is already "paid"
    // and the order is fully materialized — skip the Cashfree API call.
    const { adminDb } = await import("@/lib/server/firebaseAdmin");
    const db = adminDb();
    const intentSnap = await db.collection("paymentIntents").doc(cashfreeOrderId).get();

    if (!intentSnap.exists) {
      return NextResponse.json(
        { error: "We couldn't find this payment. Please place your order again." },
        { status: 404 },
      );
    }
    {
      const intent = intentSnap.data() as { status: string; orderId?: string; customerId?: string };
      if (intent.customerId && intent.customerId !== uid) {
        return NextResponse.json({ error: "Payment intent belongs to a different customer" }, { status: 403 });
      }
      if (intent.status === "paid" && intent.orderId) {
        const orderSnap = await db.collection("orders").doc(intent.orderId).get();
        if (orderSnap.exists) {
          const d = orderSnap.data()!;
          const { Timestamp } = await import("firebase-admin/firestore");
          const toEpoch = (v: unknown) =>
            typeof v === "number" ? v : v instanceof Timestamp ? v.toMillis() : 0;
          const order = {
            id: orderSnap.id,
            orderId: (d.orderId as string) ?? orderSnap.id,
            customerId: (d.customerId as string) ?? "",
            customerName: (d.customerName as string) ?? "",
            phone: (d.phone as string) ?? "",
            fulfillmentType: d.fulfillmentType,
            mealSlot: d.mealSlot,
            mealDate: d.mealDate,
            items: d.items,
            itemTotal: d.itemTotal,
            packagingFee: d.packagingFee,
            grandTotal: d.grandTotal,
            status: d.status,
            statusHistory: d.statusHistory,
            payment: d.payment,
            createdAt: toEpoch(d.createdAt),
            updatedAt: toEpoch(d.updatedAt),
          };
          return NextResponse.json({ order, idempotent: true });
        }
      }
      // If intent exists but status is "failed", surface that
      if (intent.status === "failed") {
        return NextResponse.json(
          { error: "Payment was not completed. Please try placing your order again." },
          { status: 400 },
        );
      }
    }
    // ─── End idempotent fast-path ────────────────────────────────────────────

    // Fetch order status from Cashfree — the redirect URL is not signed, so
    // this is the authoritative check.
    const cfOrder = await fetchCashfreeOrder(cashfreeOrderId);

    if (cfOrder.orderStatus !== "PAID") {
      if (cfOrder.orderStatus === "EXPIRED" || cfOrder.orderStatus === "TERMINATED") {
        await markIntentFailed(cashfreeOrderId, `Order ${cfOrder.orderStatus.toLowerCase()}`);
        return NextResponse.json(
          { error: "Payment session expired. Please place your order again." },
          { status: 400 },
        );
      }
      // ACTIVE means payment is still pending or failed
      return NextResponse.json(
        { error: `Payment not completed (status: ${cfOrder.orderStatus}). Please try again.` },
        { status: 400 },
      );
    }

    // Fetch the specific payment record to get cf_payment_id
    const payments = await fetchCashfreePayments(cashfreeOrderId);
    const successfulPayment = payments.find((p) => p.paymentStatus === "SUCCESS");
    if (!successfulPayment) {
      return NextResponse.json(
        { error: "Payment not confirmed. Please wait a moment and try again." },
        { status: 400 },
      );
    }

    const order = await finalizePayment({
      cashfreeOrderId,
      cfPaymentId: successfulPayment.cfPaymentId,
      expectedAmountRupees: cfOrder.paidAmount ?? successfulPayment.paymentAmount,
      callerUid: uid,
    });

    return NextResponse.json({ order });

  } catch (err) {
    console.error("verify error:", err);
    if (err instanceof PaymentFinalizeError) {
      const status = err.code === "customer_mismatch" ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    const rawMsg = (err as Error).message || "";
    if (err instanceof AuthTokenError || rawMsg.startsWith("Missing Authorization")) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again to confirm your order." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      {
        error:
          "We're taking a moment to finalize your order. If your money was deducted, your payment is safe and will be confirmed shortly. Please tap 'Retry confirming payment' below.",
      },
      { status: 500 }
    );
  }
}
