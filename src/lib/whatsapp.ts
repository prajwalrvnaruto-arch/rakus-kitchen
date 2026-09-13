import { BUSINESS } from "./config";
import type { Order } from "@/types";

export const waMeLink = (message?: string) =>
  `https://wa.me/${BUSINESS.phoneIntl}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

/** WhatsApp message for a freshly placed order. */
export const buildOrderMessage = (order: Order): string => {
  const lines: string[] = [
    "🟠 *Raku's Kitchen — NEW ORDER*",
    "",
    `🧾 Order ID: *${order.orderId}*`,
    `👤 Name: *${order.customerName}*`,
    `📞 Phone: ${order.phone}`,
    `🗓️ Meal: *${order.mealSlot}* · ${order.mealDate}`,
    `📍 Address: ${order.deliveryAddress}`,
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