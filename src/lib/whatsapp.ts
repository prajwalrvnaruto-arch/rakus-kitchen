import { BUSINESS } from "./config";
import type { Order, OrderStatus } from "@/types";

export const waMeLink = (message?: string) =>
  `https://wa.me/${BUSINESS.phoneIntl}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

/** WhatsApp message for a freshly placed order. */
export const buildOrderMessage = (order: Order): string => {
  // Build address block — use structured components if available (new orders),
  // fall back to the legacy plain string for backward compat.
  const addressLines: string[] = [];
  if (order.addressComponents) {
    addressLines.push(`📍 Address: ${order.addressComponents.displayAddress}`);
    addressLines.push(`   Flat/Building: ${order.addressComponents.doorAndBuilding}`);
    if (order.addressComponents.landmark) {
      addressLines.push(`   Landmark: ${order.addressComponents.landmark}`);
    }
  } else {
    addressLines.push(`📍 Address: ${order.deliveryAddress}`);
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
    "Delivery charges are paid by the customer to the delivery partner.",
    "Please call the customer to confirm this order and delivery. Thank you! 🙏",
  ];
  return lines.join("\n");
};


const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/* ── Order-status notifications (admin → customer) ─────────────────────── */

/** Turn a stored phone ("+91 96068 88096") into an international wa.me number ("919606888096"). */
export const phoneToIntl = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91")) return digits;
  return digits.length === 10 ? `91${digits}` : digits;
};

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
  "Order Received": (order) =>
    [
      "🟡 *Raku's Kitchen — Order Received*",
      "",
      `Hi ${order.customerName}, your order has reached our kitchen! 🧡`,
      "",
      refCard(order),
      "",
      "We'll confirm it shortly and keep you updated at every step.",
      "",
      signOff,
    ].join("\n"),

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
      "Cooked fresh, with nati-style care. You'll get a message the moment it's out for delivery.",
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
      "🎉 *Raku's Kitchen — Delivered!*",
      "",
      `Hi ${order.customerName}, we hope your meal was every bit as delicious as we intended. Thank you for choosing *Raku's Kitchen*! 🧡`,
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