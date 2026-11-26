import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { sanitizeFirestoreData } from "@/lib/sanitize";
import { decideRateLimit } from "@/lib/rate-limit-policy";
import { prepareMenuQuantityIncrements } from "./menuConfig";
import { recordServerAuditLog } from "./auditLogServer";
import { generateUniqueOrderId } from "./orderIdGenerator";
import type { OrderDraft } from "@/lib/db";
import type { FulfillmentType, Order, OrderStatus, PaymentMeta, StatusEvent } from "@/types";

/**
 * A payment intent is created before the customer is redirected to the
 * Cashfree payment page, and holds the SERVER-RECOMPUTED draft (never the
 * client's numbers). It only ever becomes a real `orders/{id}` document once
 * payment is verified — see finalizePayment(). Until then it's inert: no
 * cost, no customer-visible effect, safe to leave abandoned.
 */
export interface PaymentIntentDoc {
  customerId: string;
  draft: OrderDraft;
  amount: number; // rupees
  currency: string;
  status: "created" | "paid" | "failed";
  orderId?: string; // set once materialized
  createdAt: number;
}

export async function createIntent(params: {
  cashfreeOrderId: string;
  customerId: string;
  draft: OrderDraft;
  amountRupees: number;
}): Promise<void> {
  const db = adminDb();
  await db.collection("paymentIntents").doc(params.cashfreeOrderId).set(
    sanitizeFirestoreData({
      customerId: params.customerId,
      draft: params.draft,
      amount: params.amountRupees,
      currency: "INR",
      status: "created" as const,
      createdAt: Date.now(),
    }),
  );
}

export async function markIntentFailed(cashfreeOrderId: string, reason: string): Promise<void> {
  const db = adminDb();
  await db.collection("paymentIntents").doc(cashfreeOrderId).set(
    { status: "failed", failureReason: reason, failedAt: Date.now() },
    { merge: true },
  );
}

export class PaymentFinalizeError extends Error {
  constructor(message: string, public code: "not_found" | "customer_mismatch" | "amount_mismatch") {
    super(message);
  }
}

/**
 * Per-customer order-creation rate limit. A double-click is already caught on
 * the client, and duplicate orders are impossible (finalizePayment is
 * idempotent), but nothing stopped a scripted client from spraying
 * create-order calls — each one spawns a Cashfree order + an inert intent,
 * which is real API/log/storage cost at volume. This caps a single customer to
 * MAX_ORDERS_PER_WINDOW create-order calls per rolling window.
 */
export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Too many order attempts. Please wait a moment and try again.");
  }
}

export async function enforceOrderRateLimit(uid: string): Promise<void> {
  const db = adminDb();
  const ref = db.collection("rateLimits").doc(uid);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prior = (snap.data()?.attempts as number[] | undefined) ?? [];
    const decision = decideRateLimit(prior, now);
    if (!decision.allowed) throw new RateLimitError(decision.retryAfterSeconds);
    tx.set(ref, { attempts: decision.attempts, updatedAt: now }, { merge: true });
  });
}

/**
 * Materializes the real order from a paid intent. Idempotent: if the intent
 * is already "paid" it just re-fetches and returns the existing order rather
 * than writing a second time — safe to call from BOTH the client-facing
 * /verify route and the /webhook route without risking a double order.
 *
 * `expectedAmountRupees` is Cashfree's own reported paid amount —
 * cross-checked against what the intent was created for.
 */
export async function finalizePayment(params: {
  cashfreeOrderId: string;
  cfPaymentId: string;
  expectedAmountRupees: number;
  callerUid?: string; // present when called from /verify; absent from /webhook
}): Promise<Order> {
  const db = adminDb();
  const intentRef = db.collection("paymentIntents").doc(params.cashfreeOrderId);

  const result = await db.runTransaction(async (tx) => {
    const intentSnap = await tx.get(intentRef);
    if (!intentSnap.exists) {
      throw new PaymentFinalizeError(
        `No payment intent for Cashfree order ${params.cashfreeOrderId}`,
        "not_found",
      );
    }
    const intent = intentSnap.data() as PaymentIntentDoc;

    if (params.callerUid && intent.customerId !== params.callerUid) {
      throw new PaymentFinalizeError("Payment intent belongs to a different customer", "customer_mismatch");
    }

    // Allow ±1 rupee tolerance for floating-point rounding across systems
    if (Math.abs(intent.amount - params.expectedAmountRupees) > 1) {
      throw new PaymentFinalizeError(
        `Captured amount (₹${params.expectedAmountRupees}) does not match the intent (₹${intent.amount})`,
        "amount_mismatch",
      );
    }

    // Already finalized (webhook won the race, or this is a retried call) —
    // return the existing order instead of writing again.
    if (intent.status === "paid" && intent.orderId) {
      const existing = await tx.get(db.collection("orders").doc(intent.orderId));
      if (existing.exists) return mapOrderDoc(existing.id, existing.data()!);
    }

    // --- PHASE 1: ALL READS FIRST (Firestore requirement) ---
    const orderId = await generateUniqueOrderId(tx);
    const applyMenuQuantities = await prepareMenuQuantityIncrements(tx, intent.draft.items);

    // --- PHASE 2: ALL WRITES AFTER ALL READS ARE COMPLETE ---

    const payment: PaymentMeta = {
      provider: "cashfree",
      cashfreeOrderId: params.cashfreeOrderId,
      cfPaymentId: params.cfPaymentId,
      amount: intent.amount,
      currency: intent.currency,
      status: "paid",
      createdAt: intent.createdAt,
      paidAt: Date.now(),
    };

    applyMenuQuantities();

    const ordersRef = db.collection("orders").doc();
    const orderPayload = sanitizeFirestoreData({
      ...intent.draft,
      orderId,
      customerId: intent.customerId,
      status: "Confirmed" as OrderStatus,
      statusHistory: [{ status: "Confirmed" as OrderStatus, at: Date.now(), by: "customer_payment" }],
      payment,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(ordersRef, orderPayload);
    tx.set(intentRef, { status: "paid", orderId: ordersRef.id }, { merge: true });

    return {
      id: ordersRef.id,
      ...intent.draft,
      orderId,
      customerId: intent.customerId,
      status: "Confirmed" as OrderStatus,
      statusHistory: [{ status: "Confirmed" as OrderStatus, at: Date.now(), by: "customer_payment" }],
      payment,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } satisfies Order;
  });

  recordServerAuditLog({
    action: "order.created",
    actor: {
      uid: result.customerId,
      name: result.customerName,
      type: "customer",
    },
    targetId: result.orderId,
    summary: `New order ${result.orderId} placed by ${result.customerName} (₹${result.grandTotal})`,
    metadata: {
      orderId: result.orderId,
      grandTotal: result.grandTotal,
      fulfillmentType: result.fulfillmentType,
      itemsCount: result.items.length,
    },
  }).catch(() => {});

  return result;
}

function mapOrderDoc(id: string, d: Record<string, unknown>): Order {
  const toEpoch = (v: Timestamp | number | undefined) =>
    typeof v === "number" ? v : v instanceof Timestamp ? v.toMillis() : 0;
  return {
    id,
    orderId: (d.orderId as string) ?? id,
    customerId: (d.customerId as string) ?? "",
    customerName: (d.customerName as string) ?? "",
    phone: (d.phone as string) ?? "",
    deliveryAddress: (d.deliveryAddress as string) ?? "",
    addressComponents: d.addressComponents as Order["addressComponents"],
    deliveryMeta: d.deliveryMeta as Order["deliveryMeta"],
    fulfillmentType: (d.fulfillmentType as FulfillmentType) ?? "delivery",
    mealSlot: (d.mealSlot as "Lunch" | "Dinner") ?? "Lunch",
    mealDate: (d.mealDate as string) ?? "",
    items: (d.items as Order["items"]) ?? [],
    itemTotal: (d.itemTotal as number) ?? 0,
    packagingFee: (d.packagingFee as number) ?? 0,
    grandTotal: (d.grandTotal as number) ?? 0,
    status: (d.status as OrderStatus) ?? "Confirmed",
    statusHistory: (d.statusHistory as StatusEvent[]) ?? [],
    notes: d.notes as string | undefined,
    payment: d.payment as PaymentMeta | undefined,
    createdAt: toEpoch(d.createdAt as Timestamp | number | undefined),
    updatedAt: toEpoch(d.updatedAt as Timestamp | number | undefined),
  };
}

/**
 * Webhook dedupe — Cashfree retries webhook deliveries. Each event is keyed
 * on (type + cf_payment_id); recording it before acting makes a duplicate
 * delivery a no-op.
 */
export async function claimWebhookEvent(eventKey: string): Promise<boolean> {
  const db = adminDb();
  const ref = db.collection("webhookEvents").doc(eventKey);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) throw new Error("__duplicate__");
      tx.set(ref, { receivedAt: Date.now() });
    });
    return true;
  } catch (err) {
    if ((err as Error).message === "__duplicate__") return false;
    throw err;
  }
}

/** Releases a claimed webhook event so Cashfree's retry of a delivery we
 *  could not process yet is handled instead of being treated as a duplicate. */
export async function releaseWebhookEvent(eventKey: string): Promise<void> {
  await adminDb().collection("webhookEvents").doc(eventKey).delete().catch(() => {});
}
