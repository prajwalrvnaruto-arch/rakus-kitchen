import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { cancelBorzoOrder } from "@/lib/borzo";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { recordServerAuditLog } from "@/lib/server/auditLogServer";
import type { StatusEvent } from "@/types";

/**
 * Cancels a dispatched Borzo booking. Admin-gated: only a signed-in admin
 * may trigger a (billable, and order-mutating) cancel-order call.
 *
 * Unlike the booking route (/api/delivery/borzo), this one also writes the
 * resulting order status itself rather than leaving it to a client-SDK
 * follow-up call — it's already a server route with an Admin SDK connection,
 * so there's no reason to round-trip the write back through the browser.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as { docId?: string };
    if (!body.docId) {
      return NextResponse.json({ error: "Missing docId" }, { status: 400 });
    }

    const db = adminDb();
    const ref = db.collection("orders").doc(body.docId);
    const snap = await ref.get();
    const data = snap.data();
    if (!snap.exists || !data) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const carrierOrderId = data.deliveryMeta?.carrierOrderId as string | undefined;
    if (!carrierOrderId) {
      return NextResponse.json({ error: "No Borzo booking exists for this order" }, { status: 400 });
    }
    if (data.status === "Delivered" || data.status === "Cancelled") {
      return NextResponse.json({ error: `Order is already ${data.status}` }, { status: 400 });
    }

    const result = await cancelBorzoOrder({ carrierOrderId });

    const history = (data.statusHistory as StatusEvent[]) ?? [];
    const newEvent: StatusEvent = {
      status: "Cancelled",
      at: Date.now(),
      by: auth.uid,
    };

    await ref.update({
      status: "Cancelled",
      statusHistory: [...history, newEvent],
      "deliveryMeta.cancelledAt": Date.now(),
      "deliveryMeta.carrierStatus": result.status ?? "canceled",
      updatedAt: Date.now(),
    });

    await recordServerAuditLog({
      action: "courier.cancelled",
      actor: { uid: auth.uid, type: "admin" },
      targetId: data.orderId,
      summary: `Cancelled Borzo delivery (Carrier Order #${carrierOrderId})`,
      metadata: { carrierOrderId, mock: result.mock },
    });

    return NextResponse.json({ ok: true, mock: result.mock });
  } catch (err) {
    console.error("Borzo cancel-order error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to cancel Borzo delivery" },
      { status: 500 },
    );
  }
}
