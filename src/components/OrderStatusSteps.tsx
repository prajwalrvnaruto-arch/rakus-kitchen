"use client";

import type { FulfillmentType, OrderStatus } from "@/types";
import { ORDER_STATUS_FLOW } from "@/types";

interface StepConfig {
  key: OrderStatus;
  label: string;
  icon: string;
}

const DELIVERY_STEPS: StepConfig[] = [
  { key: "Confirmed", label: "Confirmed", icon: "✅" },
  { key: "Preparing", label: "Preparing", icon: "🍳" },
  { key: "Out for Delivery", label: "Out for delivery", icon: "🛵" },
  { key: "Delivered", label: "Delivered", icon: "🏡" },
];

const PICKUP_STEPS: StepConfig[] = [
  { key: "Confirmed", label: "Confirmed", icon: "✅" },
  { key: "Preparing", label: "Preparing", icon: "🍳" },
  { key: "Ready for Pickup", label: "Ready for pickup", icon: "🛍️" },
  { key: "Delivered", label: "Picked up", icon: "🏡" },
];

export function OrderStatusSteps({
  status,
  fulfillmentType = "delivery",
}: {
  status: OrderStatus;
  fulfillmentType?: FulfillmentType;
}) {
  if (status === "Cancelled") {
    return (
      <div className="rounded-xl border border-chili/30 bg-chili/5 p-3 text-center text-sm font-semibold text-chili">
        ✖️ This order was cancelled
      </div>
    );
  }

  const steps = fulfillmentType === "pickup" ? PICKUP_STEPS : DELIVERY_STEPS;
  const currentStep = ORDER_STATUS_FLOW[status] ?? 0;
  const pct = steps.length > 1 ? (currentStep / (steps.length - 1)) * 100 : 100;

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
        {steps.map((step, i) => {
          const reached = i <= currentStep;
          const isCurrent = i === currentStep;
          return (
            <li key={step.key} className="flex flex-1 flex-col items-center text-center">
              <div
                className={`grid h-9 w-9 place-items-center rounded-full border-2 bg-paper text-base transition ${
                  reached ? "border-chili text-chili" : "border-line text-soft/50"
                } ${isCurrent ? "bg-chili text-cream ring-4 ring-chili/15" : ""}`}
              >
                <span aria-hidden>{step.icon}</span>
              </div>
              <span
                className={`mt-1.5 max-w-[4.5rem] text-[10px] font-semibold leading-tight ${
                  reached ? "text-chilidark" : "text-soft/60"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}