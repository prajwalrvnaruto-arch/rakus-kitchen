import { BUSINESS } from "./config";
import { toWaIntl } from "./phone";
import type { Order, OrderStatus } from "@/types";

export const waMeLink = (message?: string) =>
  `https://wa.me/${BUSINESS.phoneIntl}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

/** WhatsApp message for a freshly placed order. */
export const buildOrderMessage = (order: Order): string => {
  // Build address block — use structured components if available (new orders),
  // fall back to the legacy plain string for backward compat.
  const addressLines: string[] = [];
  if (order.fulfillmentType === "pickup") {
    addressLines.push(`🏠 *Self-Pickup*`);
    addressLines.push(`   Customer will collect from: ${BUSINESS.kitchenAddress}`);
    const readyTime = order.mealSlot === "Lunch" ? BUSINESS.readyLunch : BUSINESS.readyDinner;
    addressLines.push(`   Ready by: ${readyTime}`);
  } else {
    if (order.addressComponents) {
      addressLines.push(`📍 Address: ${order.addressComponents.displayAddress}`);
      addressLines.push(`   Flat/Building: ${order.addressComponents.doorAndBuilding}`);
      if (order.addressComponents.landmark) {
        addressLines.push(`   Landmark: ${order.addressComponents.landmark}`);
      }
    } else {
      addressLines.push(`📍 Address: ${order.deliveryAddress}`);
    }
  }

  const lines: string[] = [
    "🟠 *Raku's Kitchen — NEW ORDER*",
    "",
    `🧾 Order ID: *${order.orderId}*`,
    `👤 Name: *${order.customerName}*`,
    `📞 Phone: ${order.phone}`,
    `🗓️ Meal: *${order.mealSlot}* · ${order.mealDate}`,
    ...addressLines,
    "",
    "---- Items ----",
    ...order.items.map(
      (it) =>
        `• ${it.name}${it.variant ? ` (${it.variant})` : ""} ×${it.qty} — ${rupees(
          it.lineTotal,
        )}`,
    ),
    "",
    `Items total: ${rupees(order.itemTotal)}`,
    `Packaging (per item): ${rupees(order.packagingFee)}`,
    `*GRAND TOTAL: ${rupees(order.grandTotal)}*`,
    "",
    order.fulfillmentType === "pickup"
      ? "Customer will collect this order from the kitchen."
      : "Delivery charges are paid by the customer to the delivery partner.",
    order.fulfillmentType === "pickup"
      ? "Please call the customer to confirm the pickup time. Thank you! 🙏"
      : "Please call the customer to confirm this order and delivery. Thank you! 🙏",
  ];
  return lines.join("\n");
};

/** Full wa.me link addressed to the *kitchen* (shop) for a placed order.
 *  Sources the shop number from BUSINESS.phoneIntl via waMeLink — never hardcode it. */
export const waLinkToKitchen = (order: Order): string =>
  waMeLink(buildOrderMessage(order));


const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/* ── Order-status notifications (admin → customer) ─────────────────────── */

/**
 * Turn a stored phone ("+91 96068 88096") into an international wa.me number
 * ("919606888096"). Delegates to the shared normalizer, which returns "" for
 * anything that isn't a valid Indian mobile — so a malformed number yields an
 * empty (obviously-broken) link the caller can guard, never a wrong one.
 */
export const phoneToIntl = (phone: string): string => toWaIntl(phone);

/** Compact one-line list of items, e.g. "1× Chicken Biryani, 2× Fish Fry". */
const lineItems = (order: Order): string =>
  order.items
    .map((it) => `${it.qty}× ${it.name}${it.variant ? ` (${it.variant})` : ""}`)
    .join(", ");

const signOff = `— *${BUSINESS.name}* · ${BUSINESS.tagline}`;

const refCard = (order: Order, includeItems = true) => {
  const lines = [`🧾 Order ID: *${order.orderId}*`, `🍽️ ${order.mealSlot} · ${order.mealDate}`];
  if (includeItems) lines.push(`🍛 ${lineItems(order)}`, `💰 Total: *${rupees(order.grandTotal)}*`);
  return lines.join("\n");
};

/** Per-status templates — premium, warm, and easy to scan. */
export const STATUS_MESSAGES: Record<OrderStatus, (order: Order) => string> = {
  Confirmed: (order) =>
    [
      "✅ *Raku's Kitchen — Order Confirmed*",
      "",
      `Hi ${order.customerName}, your order is confirmed — our chefs are looking forward to cooking for you. 🧡`,
      "",
      refCard(order),
      "",
      "Your meal will be cooked fresh to order. We'll let you know the moment it's ready.",
      "",
      signOff,
    ].join("\n"),

  Preparing: (order) =>
    [
      "👨‍🍳 *Raku's Kitchen — Now Preparing*",
      "",
      `Hi ${order.customerName}, great news — our kitchen is preparing your order right now!`,
      "",
      refCard(order),
      "",
      order.fulfillmentType === "pickup"
        ? "Cooked fresh, with nati-style care. You'll get a message the moment it's packed and ready for pickup."
        : "Cooked fresh, with nati-style care. You'll get a message the moment it's out for delivery.",
      "",
      signOff,
    ].join("\n"),

  "Ready for Pickup": (order) =>
    [
      "🛍️ *Raku's Kitchen — Ready for Pickup!*",
      "",
      `Hi ${order.customerName}, great news! Your order is hot, packed, and ready for pickup at our kitchen! 🎉`,
      "",
      refCard(order, false),
      "",
      "📍 *Pickup Address:*",
      `${BUSINESS.kitchenAddress}`,
      `Maps: https://maps.google.com/?q=${BUSINESS.lat},${BUSINESS.lng}`,
      "",
      "Please collect it whenever you're ready. See you soon!",
      "",
      signOff,
    ].join("\n"),

  "Out for Delivery": (order) =>
    [
      "🛵 *Raku's Kitchen — Out for Delivery*",
      "",
      `Hi ${order.customerName}, your order is on its way! 🎉`,
      "",
      refCard(order, false),
      "",
      "Our delivery partner will call you shortly — please keep your phone handy.",
      "",
      "We hope it arrives hot and delicious!",
      "",
      signOff,
    ].join("\n"),

  Delivered: (order) =>
    [
      order.fulfillmentType === "pickup"
        ? "🎉 *Raku's Kitchen — Order Picked Up!*"
        : "🎉 *Raku's Kitchen — Delivered!*",
      "",
      order.fulfillmentType === "pickup"
        ? `Hi ${order.customerName}, thank you for picking up your order from Raku's Kitchen! We hope your meal is every bit as delicious as we intended. 🧡`
        : `Hi ${order.customerName}, we hope your meal was every bit as delicious as we intended. Thank you for choosing *Raku's Kitchen*! 🧡`,
      "",
      `If you loved it, a quick word on Instagram (@${BUSINESS.instagram}) means the world to a small kitchen like ours. 📸`,
      "",
      "We can't wait to cook for you again.",
      "",
      signOff,
    ].join("\n"),

  Cancelled: (order) =>
    [
      "🟠 *Raku's Kitchen — Order Cancelled*",
      "",
      `Hi ${order.customerName}, your order ${order.orderId} has been cancelled as requested.`,
      "",
      "If there's anything we could have done differently, we'd love to make it right — just reply here and we'll take care of you personally. 🙏",
      "",
      "We hope to serve you again soon.",
      "",
      signOff,
    ].join("\n"),
};

/** WhatsApp draft for a customer about to be notified of a new status. */
export const buildStatusMessage = (order: Order, status: OrderStatus): string =>
  STATUS_MESSAGES[status]?.(order) ?? `Your order ${order.orderId} is now “${status}”.`;

/** Full wa.me link addressed to the *customer* for a given status. */
export const waLinkToCustomer = (order: Order, status: OrderStatus): string =>
  `https://wa.me/${phoneToIntl(order.phone)}?text=${encodeURIComponent(buildStatusMessage(order, status))}`;