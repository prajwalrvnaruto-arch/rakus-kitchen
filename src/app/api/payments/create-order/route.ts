import { NextResponse } from "next/server";
import { verifyIdToken, AuthTokenError } from "@/lib/server/firebaseAdmin";
import { normalizeIndianMobile } from "@/lib/phone";
import { createCashfreeOrder, cashfreeMode } from "@/lib/server/cashfree";
import { createIntent, enforceOrderRateLimit, RateLimitError } from "@/lib/server/paymentIntents";
import { checkQuantityLimits } from "@/lib/server/menuConfig";
import { recomputeOrderTotals } from "@/lib/menu";
import { validateMeal } from "@/lib/order-dates";
import { isWithinServiceArea, OUT_OF_SERVICE_AREA_MESSAGE } from "@/lib/geofence";
import type { OrderDraft } from "@/lib/db";
import type { AddressComponents, FulfillmentType, MealSlot, OrderLineItem } from "@/types";

export const runtime = "nodejs";

/** Upper bounds on free-text fields, so one order can't store unbounded input. */
const MAX_LEN = { name: 80, notes: 500, address: 500, addressPart: 200 } as const;

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
 * a Cashfree order for that amount and stash a paymentIntent holding the
 * verified draft. Nothing is written to /orders yet — see finalizePayment().
 *
 * Returns `paymentSessionId` which the browser passes to Cashfree.js to open
 * the payment modal, and `cashfreeOrderId` which is used to verify after redirect.
 */
export async function POST(request: Request) {
  try {
    const { uid } = await verifyIdToken(request.headers.get("authorization"));

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

    const { digits10: phone10 } = normalizeIndianMobile(body.phone);
    if (!phone10) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit Indian mobile number.", code: "invalid_phone" },
        { status: 400 },
      );
    }

    const tooLong =
      body.customerName.trim().length > MAX_LEN.name ? "Name"
      : (body.notes?.length ?? 0) > MAX_LEN.notes ? "Order note"
      : (body.deliveryAddress?.length ?? 0) > MAX_LEN.address ? "Delivery address"
      : (body.addressComponents?.doorAndBuilding?.length ?? 0) > MAX_LEN.addressPart ? "Flat / building"
      : (body.addressComponents?.landmark?.length ?? 0) > MAX_LEN.addressPart ? "Landmark"
      : null;
    if (tooLong) {
      return NextResponse.json({ error: `${tooLong} is too long.`, code: "field_too_long" }, { status: 400 });
    }

    const mealProblem = validateMeal({ date: body.mealDate, slot: body.mealSlot });
    if (mealProblem) {
      return NextResponse.json({ error: mealProblem }, { status: 400 });
    }

    if (fulfillmentType === "delivery") {
      const coords = body.addressComponents;
      if (!coords || typeof coords.lat !== "number" || typeof coords.lng !== "number") {
        return NextResponse.json({ error: "Please pick your address from the search suggestions or use My location." }, { status: 400 });
      }
      if (!isWithinServiceArea(coords.lat, coords.lng, { pincode: coords.pincode, state: coords.state })) {
        return NextResponse.json(
          { error: OUT_OF_SERVICE_AREA_MESSAGE, code: "out_of_service_area" },
          { status: 400 },
        );
      }
    }

    const recomputed = recomputeOrderTotals(
      body.items.map((it) => ({ menuId: it.menuId, name: it.name, variant: it.variant, qty: it.qty })),
    );
    if ("error" in recomputed) {
      return NextResponse.json({ error: recomputed.error }, { status: 400 });
    }

    const limitCheck = await checkQuantityLimits(recomputed.items);
    if (!limitCheck.ok) {
      return NextResponse.json(
        { error: limitCheck.error, code: "quantity_limit_exceeded" },
        { status: 409 },
      );
    }

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

    const amountRupees = recomputed.grandTotal;
    if (amountRupees <= 0) {
      return NextResponse.json({ error: "Order total must be greater than zero" }, { status: 400 });
    }

    // Merchant order ID: short, unique, URL-safe
    const cashfreeOrderId = `rk-${uid.slice(0, 8)}-${Date.now()}`;

    // Build return URL — Cashfree appends ?order_id={order_id} on redirect
    const origin = request.headers.get("origin") ?? "https://rakuskitchen.com";
    const returnUrl = `${origin}/checkout/confirm`;

    const cfOrder = await createCashfreeOrder({
      orderId: cashfreeOrderId,
      amountRupees,
      customerId: uid,
      customerPhone: phone10,
      customerName: body.customerName.trim(),
      returnUrl,
      note: `${draft.mealSlot} · ${draft.mealDate}`,
    });

    await createIntent({
      cashfreeOrderId,
      customerId: uid,
      draft,
      amountRupees,
    });

    return NextResponse.json({
      cashfreeOrderId: cfOrder.orderId,
      paymentSessionId: cfOrder.paymentSessionId,
      amount: cfOrder.amount,
      currency: cfOrder.currency,
      mode: cashfreeMode(),
    });
  } catch (err) {
    console.error("create-order error:", err);
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 429 },
      );
    }
    const rawMsg = (err as Error).message || "";
    if (err instanceof AuthTokenError || rawMsg.startsWith("Missing Authorization")) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again to place your order." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Unable to start checkout right now. Please refresh and try again in a moment." },
      { status: 500 }
    );
  }
}
