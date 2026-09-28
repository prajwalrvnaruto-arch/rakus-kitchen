import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/server/firebaseAdmin";
import { verifyPaymentSignature, fetchRazorpayPayment } from "@/lib/server/razorpay";
import { finalizePayment, markIntentFailed, PaymentFinalizeError } from "@/lib/server/paymentIntents";

export const runtime = "nodejs";

interface VerifyBody {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

/**
 * Step 2 of checkout: the browser calls this right after Razorpay Checkout's
 * `handler` fires with a successful payment. Verifies the signature, then
 * double-checks the payment's actual captured amount/status with Razorpay
 * directly (belt-and-suspenders — the signature alone already proves it came
 * from Razorpay), then materializes the order.
 *
 * This is a convenience path for a fast "done" screen — it is NOT the only
 * way an order gets created. If the browser is killed before this call lands
 * (common on UPI app-switch), /api/payments/webhook performs the identical
 * finalizePayment() independently.
 */
export async function POST(request: Request) {
  let orderId: string | undefined;
  try {
    const { uid } = await verifyIdToken(request.headers.get("authorization"));
    const body = (await request.json()) as VerifyBody;
    orderId = body.razorpay_order_id;

    if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
      return NextResponse.json({ error: "Missing payment verification fields" }, { status: 400 });
    }

    const signatureOk = verifyPaymentSignature({
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });
    if (!signatureOk) {
      await markIntentFailed(body.razorpay_order_id, "Signature verification failed");
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    }

    const payment = await fetchRazorpayPayment(body.razorpay_payment_id);
    if (payment.status !== "captured" && payment.status !== "authorized") {
      return NextResponse.json({ error: `Payment not completed (status: ${payment.status})` }, { status: 400 });
    }

    const order = await finalizePayment({
      razorpayOrderId: body.razorpay_order_id,
      razorpayPaymentId: body.razorpay_payment_id,
      expectedAmountPaise: Number(payment.amount),
      callerUid: uid,
    });

    return NextResponse.json({ order });
  } catch (err) {
    console.error("verify error:", err);
    if (err instanceof PaymentFinalizeError) {
      const status = err.code === "customer_mismatch" ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    const msg = (err as Error).message || "Could not verify payment";
    const status = msg.startsWith("Missing Authorization") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
