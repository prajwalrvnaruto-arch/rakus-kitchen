import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/server/firebaseAdmin";
import { createRazorpayOrder } from "@/lib/server/razorpay";
import { createIntent, enforceOrderRateLimit, RateLimitError } from "@/lib/server/paymentIntents";
import { checkQuantityLimits } from "@/lib/server/menuConfig";
import { recomputeOrderTotals } from "@/lib/menu";
import { validateMeal } from "@/lib/order-dates";
import type { OrderDraft } from "@/lib/db";
import type { AddressComponents, FulfillmentType, MealSlot, OrderLineItem } from "@/types";

export const runtime = "nodejs";

interface CreateOrderBody {
  customerName?: string;
  phone?: string;
  deliveryAddress?: string;
  addressComponents?: AddressComponents;
  fulfillmentType?: FulfillmentType;
  mealSlot?: MealSlot;
  mealDate?: string;
  items?: OrderLineItem[];
  notes?: string;
  /** The grand total the client displayed at confirm time. ADVISORY ONLY —
   *  never used to charge; only compared against the server's recomputed total
   *  to catch a price that changed mid-session (see the price_changed guard). */
  clientGrandTotal?: number;
}

/**
 * Step 1 of checkout: recompute the real price from menu.ts (never trust the
 * client's numbers), validate the meal slot is still orderable, then create
 * a Razorpay order for that amount and stash a paymentIntent holding the
 * verified draft. Nothing is written to /orders yet — see finalizePayment().
 */
export async function POST(request: Request) {
  try {
    const { uid } = await verifyIdToken(request.headers.get("authorization"));

    // Throttle a single customer's create-order calls before doing any work,
    // so a scripted client can't spray Razorpay orders + inert intents.
    await enforceOrderRateLimit(uid);

    const body = (await request.json()) as CreateOrderBody;

    const fulfillmentType = body.fulfillmentType ?? "delivery";

    if (
      !body.customerName?.trim() || !body.phone?.trim()
      || (fulfillmentType === "delivery" && !body.deliveryAddress?.trim())
      || !body.mealSlot || !body.mealDate || !Array.isArray(body.items) || body.items.length === 0
    ) {
      return NextResponse.json({ error: "Missing required order fields" }, { status: 400 });
    }

    const mealProblem = validateMeal({ date: body.mealDate, slot: body.mealSlot });
    if (mealProblem) {
      return NextResponse.json({ error: mealProblem }, { status: 400 });
    }

    // The only source of truth for prices — client-submitted pricePerUnit/lineTotal
    // are ignored entirely.
    const recomputed = recomputeOrderTotals(
      body.items.map((it) => ({ menuId: it.menuId, name: it.name, variant: it.variant, qty: it.qty })),
    );
    if ("error" in recomputed) {
      return NextResponse.json({ error: recomputed.error }, { status: 400 });
    }

    // Block order if any requested quantity would exceed that item's configured
    // limit. This is the authoritative gate — finalizePayment also increments
    // counters, but can't reject (payment already captured, no refund path).
    const limitCheck = await checkQuantityLimits(recomputed.items);
    if (!limitCheck.ok) {
      return NextResponse.json(
        { error: limitCheck.error, code: "quantity_limit_exceeded" },
        { status: 409 },
      );
    }

    // Catch a price that changed while the customer was browsing: if the total
    // they confirmed differs from the freshly-recomputed one, don't silently
    // charge the new amount — surface it so they re-review first. The server
    // total is always authoritative for the actual charge; clientGrandTotal is
    // advisory only. A missing clientGrandTotal (older client) skips the check.
    if (
      typeof body.clientGrandTotal === "number"
      && Math.round(body.clientGrandTotal) !== Math.round(recomputed.grandTotal)
    ) {
      return NextResponse.json(
        {
          error: "Some prices changed since you added items. Please review the updated total.",
          code: "price_changed",
          newTotal: recomputed.grandTotal,
        },
        { status: 409 },
      );
    }

    const draft: OrderDraft = {
      customerName: body.customerName.trim(),
      phone: body.phone.trim(),
      deliveryAddress: fulfillmentType === "pickup" ? "" : body.deliveryAddress!.trim(),
      addressComponents: fulfillmentType === "pickup" ? undefined : body.addressComponents,
      fulfillmentType,
      mealSlot: body.mealSlot,
      mealDate: body.mealDate,
      items: recomputed.items,
      itemTotal: recomputed.itemTotal,
      packagingFee: recomputed.packagingFee,
      grandTotal: recomputed.grandTotal,
      notes: body.notes?.trim() || undefined,
    };

    const amountPaise = Math.round(draft.grandTotal * 100);
    if (amountPaise <= 0) {
      return NextResponse.json({ error: "Order total must be greater than zero" }, { status: 400 });
    }

    const rzpOrder = await createRazorpayOrder({
      amountPaise,
      receipt: `rk-${uid.slice(0, 8)}-${Date.now()}`,
      notes: { customerId: uid, mealDate: draft.mealDate, mealSlot: draft.mealSlot },
    });

    await createIntent({
      razorpayOrderId: rzpOrder.id,
      customerId: uid,
      draft,
      amountPaise,
    });

    return NextResponse.json({
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("create-order error:", err);
    const msg = (err as Error).message || "Could not start payment";
    const status = msg.startsWith("Missing Authorization") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
