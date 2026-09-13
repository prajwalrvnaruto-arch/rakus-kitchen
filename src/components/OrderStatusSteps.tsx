"use client";

import type { OrderStatus } from "@/types";
import { ORDER_STATUSES, ORDER_STATUS_FLOW } from "@/types";

const STATUS_ICONS: Record<Exclude<OrderStatus, "Cancelled">, string> = {
  "Order Received": "📥",
  Confirmed: "✅",
  Preparing: "🍳",
  "Out for Delivery": "🛵",
  Delivered: "🏡",
};

const SHORT_LABELS: Record<string, string> = {
  "Order Received": "Received",
  "Out for Delivery": "Out for delivery",
};

export function OrderStatusSteps({ status }: { status: OrderStatus }) {
  if (status === "Cancelled") {
    return (
      <div className="rounded-xl border border-chili/30 bg-chili/5 p-3 text-center text-sm font-semibold text-chili">
        ✖️ This order was cancelled
      </div>
    );
  }

  const currentStep = ORDER_STATUS_FLOW[status];
  const pct = ORDER_STATUSES.length > 1 ? (currentStep / (ORDER_STATUSES.length - 1)) * 100 : 100;

  return (
    <div className="relative pt-1">
      {/* track + progress fill (drawn behind the dots) */}
      <div className="absolute left-[10%] right-[10%] top-[1.4rem] h-0.5 rounded bg-line" aria-hidden />
      <div
        className="absolute left-[10%] top-[1.4rem] h-0.5 rounded bg-chili transition-all duration-500"
        style={{ width: `${pct * 0.8}%` }}
        aria-hidden
      />

      <ol className="relative flex justify-between">
        {ORDER_STATUSES.map((s, i) => {
          const reached = i <= currentStep;
          const isCurrent = i === currentStep;
          return (
            <li key={s} className="flex flex-1 flex-col items-center text-center">
              <div
                className={`grid h-9 w-9 place-items-center rounded-full border-2 bg-paper text-base transition ${
                  reached ? "border-chili text-chili" : "border-line text-soft/50"
                } ${isCurrent ? "bg-chili text-cream ring-4 ring-chili/15" : ""}`}
              >
                <span aria-hidden>{STATUS_ICONS[s as keyof typeof STATUS_ICONS]}</span>
              </div>
              <span
                className={`mt-1.5 max-w-[4.5rem] text-[10px] font-semibold leading-tight ${
                  reached ? "text-chilidark" : "text-soft/60"
                }`}
              >
                {SHORT_LABELS[s] ?? s}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}