"use client";

import { useId, useState } from "react";
import { formatKg, totalWeightByDish, type SlotPrepSummary } from "@/lib/kitchenPrep";

/**
 * Renders a single meal slot's aggregated prep sheet.
 */
export function KitchenPrepSlot({ summary }: { summary: SlotPrepSummary }) {
  const slotEmoji = summary.slot === "Lunch" ? "🌞" : "🌙";
  const weightTotals = totalWeightByDish(summary.rows);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full items-center justify-between gap-3 bg-cream/40 px-5 py-3.5 text-left transition-colors hover:bg-cream/70 ${open ? "border-b border-line" : ""}`}
      >
        <div>
          <h2 className="font-display text-lg font-bold text-ink">
            {slotEmoji} {summary.slot.toUpperCase()} SLOT
          </h2>
          <p className="text-xs text-soft mt-1">
            Combined across {summary.orderCount} {summary.orderCount === 1 ? "order" : "orders"} · {summary.totalItems} total {summary.totalItems === 1 ? "item" : "items"}
          </p>
        </div>
        <span
          aria-hidden
          className={`shrink-0 text-lg text-soft transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
      <div id={panelId}>
      <div className="divide-y divide-line">
        {summary.rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-soft">
            No orders for this slot yet.
          </div>
        ) : (
          summary.rows.map((row, idx) => {
            const isAddonChild = row.isAddon;
            const indent = isAddonChild ? "ml-8" : "";

            return (
              <div
                key={`${row.menuId}-${row.variant}-${idx}`}
                className={`flex items-center justify-between px-5 py-3 text-sm ${isAddonChild ? "bg-cream/20" : ""}`}
              >
                <div className={`min-w-0 ${indent}`}>
                  <p className="font-semibold text-ink">
                    {row.name}
                    {row.variant && <span className="font-normal text-soft ml-1">({row.variant})</span>}
                  </p>
                  {isAddonChild && (
                    <p className="text-xs text-soft">Add-on</p>
                  )}
                </div>
                <div className="shrink-0 text-right font-bold text-chilidark">
                  {row.totalQty} × {row.totalWeightKg !== undefined
                    ? `${(row.totalWeightKg / row.totalQty).toFixed(1)} kg`
                    : row.variant || row.unit || "unit(s)"}
                </div>
              </div>
            );
          })
        )}
      </div>

      {weightTotals.length > 0 && (
        <div className="border-t-2 border-line bg-cream/40">
          <p className="px-5 pt-3 text-xs font-bold uppercase tracking-wide text-soft">
            Total by weight
          </p>
          <div className="divide-y divide-line">
            {weightTotals.map((t) => (
              <div key={t.key} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <p className="font-semibold text-ink">{t.name}</p>
                <p className="shrink-0 font-bold text-chilidark">{formatKg(t.kg)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.rows.length > 0 && (
        <div className="border-t border-line bg-cream/30 px-5 py-3 text-xs text-soft font-semibold">
          <span className="block">✓ Prep sheet ready for kitchen</span>
        </div>
      )}
      </div>
      )}
    </div>
  );
}
