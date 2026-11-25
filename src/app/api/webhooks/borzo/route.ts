import { NextResponse } from "next/server";
import { verifyBorzoWebhookSignature } from "@/lib/borzo";
import { claimWebhookEvent } from "@/lib/server/paymentIntents";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { recordServerAuditLog } from "@/lib/server/auditLogServer";
import type { OrderStatus, StatusEvent } from "@/types";

export const runtime = "nodejs";

/**
 * Borzo order/delivery status callback — configure the Callback URL in
 * Borzo's Personal cabinet to https://<domain>/api/webhooks/borzo, with the
 * "Callback Secret Key" shown there set as BORZO_WEBHOOK_SECRET (distinct
 * from BORZO_API_KEY). Borzo retries with increasing intervals for 24h on
 * any non-2XX response, so this must return quickly and tolerate redelivery.
 *
 * This endpoint is informational for most statuses — it records Borzo's raw
 * status onto deliveryMeta.carrierStatus for admin visibility, and only
 * drives the admin-facing OrderStatus state machine for the two terminal
 * outcomes (delivered/cancelled), since every other transition is otherwise
 * managed by the admin's manual status dropdown.
 */

interface BorzoOrderPoint {
  client_order_id?: string | null;
}

interface BorzoOrderWebhookPayload {
  event_datetime: string;
  event_type: "order_created" | "order_changed";
  order: {
    order_id: number;
    status: string;
    status_description?: string;
    points?: BorzoOrderPoint[];
  };
}

interface BorzoDeliveryWebhookPayload {
  event_datetime: string;
  event_type: "delivery_created" | "delivery_changed";
  delivery: {
    delivery_id: number;
    order_id?: number | null;
    client_order_id?: string | null;
    status: string;
    status_description?: string;
    status_datetime: string;
  };
}

type BorzoWebhookPayload = BorzoOrderWebhookPayload | BorzoDeliveryWebhookPayload;

// Only these two Borzo statuses should ever auto-advance our own OrderStatus;
// every other status (courier_assigned, parcel_picked_up, delayed, etc.) is
// recorded for visibility only.
const ORDER_TERMINAL: Partial<Record<string, OrderStatus>> = {
  completed: "Delivered",
  canceled: "Cancelled",
};
const DELIVERY_TERMINAL: Partial<Record<string, OrderStatus>> = {
  finished: "Delivered",
  canceled: "Cancelled",
};

export async function POST(request: Request) {
  // Read the RAW body and verify BEFORE any JSON.parse — Borzo signs the
  // exact bytes it sent (same rule as the Razorpay/WhatsApp webhooks).
  const rawBody = await request.text();
  const signature = request.headers.get("x-dv-signature");

  if (!verifyBorzoWebhookSignature(rawBody, signature)) {
    console.warn("[borzo webhook] signature verification failed");
    // 400, not 401 — this endpoint has no concept of caller identity, only
    // "is this really from Borzo".
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: BorzoWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  try {
    if (payload.event_type === "order_created" || payload.event_type === "order_changed") {
      await handleOrderEvent(payload);
    } else if (payload.event_type === "delivery_created" || payload.event_type === "delivery_changed") {
      await handleDeliveryEvent(payload);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[borzo webhook] processing error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handleOrderEvent(payload: BorzoOrderWebhookPayload): Promise<void> {
  const { order } = payload;
  // Our own order id is set as client_order_id on the drop point only (see
  // createBorzoOrder) — the pickup point's client_order_id is always empty.
  const clientOrderId = order.points?.find((p) => p.client_order_id)?.client_order_id;
  if (!clientOrderId) return;

  const isNew = await claimWebhookEvent(`borzo-order:${order.order_id}:${order.status}`);
  if (!isNew) return;

  await applyCarrierStatus({
    orderId: clientOrderId,
    carrierStatus: order.status,
    carrierStatusAt: Date.parse(payload.event_datetime) || Date.now(),
    terminalStatus: ORDER_TERMINAL[order.status],
  });
}

async function handleDeliveryEvent(payload: BorzoDeliveryWebhookPayload): Promise<void> {
  const { delivery } = payload;
  if (!delivery.client_order_id) return;

  const isNew = await claimWebhookEvent(`borzo-delivery:${delivery.delivery_id}:${delivery.status}`);
  if (!isNew) return;

  await applyCarrierStatus({
    orderId: delivery.client_order_id,
    carrierStatus: delivery.status,
    carrierStatusAt: Date.parse(delivery.status_datetime) || Date.now(),
    terminalStatus: DELIVERY_TERMINAL[delivery.status],
  });
}

async function applyCarrierStatus(params: {
  orderId: string;
  carrierStatus: string;
  carrierStatusAt: number;
  terminalStatus?: OrderStatus;
}): Promise<void> {
  const db = adminDb();
  const snap = await db.collection("orders").where("orderId", "==", params.orderId).limit(1).get();
  if (snap.empty) {
    // Nothing to annotate — not a transient race (the order would already
    // exist by the time Borzo reports a status), so no retry needed.
    console.warn(`[borzo webhook] no order found for orderId=${params.orderId}`);
    return;
  }
  const ref = snap.docs[0].ref;

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.data();
    if (!data) return;

    // Borzo doesn't guarantee delivery order of callbacks — never let an
    // older status clobber a newer one that already landed.
    const existingAt = data.deliveryMeta?.carrierStatusAt ?? 0;
    if (params.carrierStatusAt < existingAt) return;

    const updates: Record<string, unknown> = {
      "deliveryMeta.carrierStatus": params.carrierStatus,
      "deliveryMeta.carrierStatusAt": params.carrierStatusAt,
      updatedAt: Date.now(),
    };

    const currentStatus = data.status as OrderStatus;
    const isLocked = currentStatus === "Delivered" || currentStatus === "Cancelled";
    if (params.terminalStatus && !isLocked && params.terminalStatus !== currentStatus) {
      const history = (data.statusHistory as StatusEvent[]) ?? [];
      const newEvent: StatusEvent = {
        status: params.terminalStatus,
        at: Date.now(),
        by: "system:borzo-webhook",
      };
      updates.status = params.terminalStatus;
      updates.statusHistory = [...history, newEvent];
    }

    tx.update(ref, updates);
  });

  await recordServerAuditLog({
    action: "courier.status_updated",
    actor: { type: "system" },
    targetId: params.orderId,
    summary: `Borzo delivery status: ${params.carrierStatus}`,
    metadata: { carrierStatus: params.carrierStatus },
  });
}
