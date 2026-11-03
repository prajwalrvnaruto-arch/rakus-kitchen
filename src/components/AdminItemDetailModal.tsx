"use client";

import { useEffect, useMemo } from "react";
import type { Order } from "@/types";
import { formatINR } from "@/lib/menu";
import { computeItemDetail } from "@/lib/analytics";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface ItemDetailModalState {
  menuId: string;
  name: string;
  emoji: string;
}

interface AdminItemDetailModalProps {
  modal: ItemDetailModalState | null;
  onClose: () => void;
  /** The order set to compute the detail view from — pass the tab's full
   *  lifetime-or-live-capped `sourceOrders`, not the narrow preset-filtered
   *  array, so the trend chart isn't collapsed to a single day. */
  orders: Order[];
}

export function AdminItemDetailModal({ modal, onClose, orders }: AdminItemDetailModalProps) {
  useEffect(() => {
    if (!modal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal, onClose]);

  const detail = useMemo(() => {
    if (!modal) return null;
    return computeItemDetail(orders, modal.menuId);
  }, [orders, modal]);

  if (!modal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inkdark/80 p-3 sm:p-4 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border-2 border-line bg-paper shadow-2xl animate-scale-up">
        <header className="flex items-center justify-between border-b border-line bg-cream px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-turmeric/20 text-lg">
              {modal.emoji || "🍽️"}
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-ink">{modal.name}</h3>
              <p className="text-xs text-soft">Item Performance Deep-Dive</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-soft hover:bg-creamdark hover:text-ink transition"
            aria-label="Close modal"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 text-sm">
          {!detail ? (
            <div className="rounded-xl border border-line bg-cream/30 p-4 text-center text-xs text-soft">
              No order history found for this item.
            </div>
          ) : (
            <>
              {/* Stat row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-line bg-cream/30 p-3 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-soft">
                    Orders
                  </div>
                  <div className="mt-1 text-lg font-bold text-ink">{detail.totalOrders}</div>
                </div>
                <div className="rounded-xl border border-line bg-cream/30 p-3 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-soft">
                    Units Sold
                  </div>
                  <div className="mt-1 text-lg font-bold text-ink">{detail.totalUnitsSold}</div>
                </div>
                <div className="rounded-xl border border-line bg-cream/30 p-3 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-soft">
                    Revenue
                  </div>
                  <div className="mt-1 text-sm font-bold text-ink">
                    {formatINR(detail.totalRevenue)}
                  </div>
                </div>
              </div>

              {/* Daily trend */}
              <div className="rounded-xl border border-line/70 bg-paper p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-soft">
                  Trend Over Time
                </p>
                <div className="h-40 w-full">
                  {detail.dailyTrend.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-soft">
                      No paid orders recorded for this item.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={detail.dailyTrend} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="itemTrendGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d97706" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: "#78716c" }}
                          axisLine={{ stroke: "#e7e5e4" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#78716c" }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1c1917",
                            borderRadius: "10px",
                            border: "none",
                            color: "#fff",
                            fontSize: "11px",
                          }}
                          formatter={(value: any) => [value, "Units sold"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="unitsSold"
                          stroke="#d97706"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#itemTrendGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Peak day(s) */}
              {detail.peakDays.length > 0 && (
                <div className="rounded-xl border border-line/70 bg-paper p-3 text-xs space-y-1">
                  <p className="font-semibold text-soft uppercase tracking-wider">
                    Peak Order Day{detail.peakDays.length > 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.peakDays.map((d) => (
                      <span
                        key={d.date}
                        className="inline-flex items-center gap-1 rounded-lg bg-turmeric/15 px-2 py-1 text-[11px] font-medium text-ink"
                      >
                        🔥 {d.label} — {d.unitsSold} units
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Co-ordered items */}
              <div className="rounded-xl border border-line/70 bg-paper p-3 text-xs space-y-1.5">
                <p className="font-semibold text-soft uppercase tracking-wider">
                  Commonly Ordered Together
                </p>
                {detail.coOrderedItems.length === 0 ? (
                  <p className="text-soft">No co-ordered items found.</p>
                ) : (
                  <div className="space-y-1">
                    {detail.coOrderedItems.map((entry) => (
                      <div
                        key={entry.menuId}
                        className="flex items-center justify-between rounded-lg bg-cream/30 px-2.5 py-1.5"
                      >
                        <span className="flex items-center gap-1.5 font-medium text-ink">
                          <span>{entry.emoji}</span>
                          <span>{entry.name}</span>
                        </span>
                        <span className="text-soft">
                          ordered together {entry.coOrderCount}×
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2.5 border-t border-line bg-cream/40 px-5 py-3">
          <button type="button" onClick={onClose} className="btn btn-ghost px-5 py-2 text-xs font-bold">
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
