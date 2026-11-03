"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Order } from "@/types";
import { formatINR } from "@/lib/menu";
import { fetchAllOrdersOnce } from "@/lib/db";
import {
  computeAnalytics,
  diffKPIs,
  exportOrdersToCSV,
  filterOrdersByDate,
  getPreviousPeriodRange,
  type DateRangePreset,
  type KPIComparison,
} from "@/lib/analytics";
import { AdminItemDetailModal, type ItemDetailModalState } from "@/components/AdminItemDetailModal";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// Static caption naming what each preset's comparison badge is measured
// against — only the presets getPreviousPeriodRange actually supports.
const COMPARISON_CAPTION: Partial<Record<DateRangePreset, string>> = {
  today: "vs yesterday",
  last7days: "vs prior 7 days",
  monthToDate: "vs last month (same day)",
};

interface AdminAnalyticsTabProps {
  orders: Order[];
}

// Small inline badge rendering a KPIComparison: "New" (sky) when there was no
// activity in the previous period, "±0%" (neutral) when both periods are
// zero, or a colored ▲/▼ percent otherwise. Never renders Infinity/NaN.
function ComparisonBadge({ comparison }: { comparison: KPIComparison }) {
  if (comparison.isNew) {
    return (
      <span className="text-[10px] font-semibold text-sky-600">New</span>
    );
  }
  if (comparison.percentChange === null) {
    return <span className="text-[10px] font-semibold text-stone-400">±0%</span>;
  }
  const up = comparison.percentChange >= 0;
  return (
    <span className={`text-[10px] font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(comparison.percentChange).toFixed(0)}%
    </span>
  );
}

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7days: "Last 7 Days",
  monthToDate: "This Month",
  all: "All Time",
};

const CATEGORY_COLORS = [
  "#d97706", // amber-600
  "#059669", // emerald-600
  "#dc2626", // red-600
  "#7c3aed", // violet-600
  "#0284c7", // sky-600
  "#4b5563", // gray-600
];

export function AdminAnalyticsTab({ orders }: AdminAnalyticsTabProps) {
  const [preset, setPreset] = useState<DateRangePreset>("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // The `orders` prop comes from the live dashboard listener (subscribeAllOrders),
  // which is capped to the most recent LIVE_ORDERS_LIMIT orders so the listener
  // stays cheap as volume grows. That's fine for "Today"/"Last 7 Days", but
  // "All Time" needs TRUE lifetime totals — so for that preset only, fetch the
  // full history once (fetchAllOrdersOnce) instead of relying on the capped
  // live array. Every other preset keeps using the live `orders` prop as before.
  const [allTimeOrders, setAllTimeOrders] = useState<Order[] | null>(null);
  const [allTimeLoading, setAllTimeLoading] = useState(false);
  const [allTimeError, setAllTimeError] = useState<string | null>(null);

  useEffect(() => {
    if (preset !== "all" || allTimeOrders !== null || allTimeLoading) return;
    let cancelled = false;
    setAllTimeLoading(true);
    setAllTimeError(null);
    fetchAllOrdersOnce()
      .then((all) => {
        if (!cancelled) setAllTimeOrders(all);
      })
      .catch((err) => {
        console.error("[AdminAnalyticsTab] fetchAllOrdersOnce failed:", err);
        if (!cancelled) setAllTimeError("Couldn't load full order history. Showing recent orders only.");
      })
      .finally(() => {
        if (!cancelled) setAllTimeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preset, allTimeOrders, allTimeLoading]);

  // Source orders: lifetime fetch for "All Time" (once loaded; falls back to
  // the live-capped prop while loading or if the fetch failed), live prop otherwise.
  const sourceOrders = preset === "all" && allTimeOrders ? allTimeOrders : orders;

  // Filter orders according to selected date preset
  const filteredOrders = useMemo(() => {
    return filterOrdersByDate(sourceOrders, preset);
  }, [sourceOrders, preset]);

  // Compute analytical rollups
  const analytics = useMemo(() => {
    return computeAnalytics(filteredOrders, preset);
  }, [filteredOrders, preset]);

  // ── Period-over-period comparison: current preset vs its own predecessor ──
  // (today vs yesterday, last7days vs prior 7 days, monthToDate vs same point
  // last month). Null for "yesterday"/"all" — no defined previous period.
  const previousRange = useMemo(() => getPreviousPeriodRange(preset), [preset]);
  const previousOrders = useMemo(() => {
    if (!previousRange) return null;
    return sourceOrders.filter(
      (o) => o.createdAt >= previousRange.minTime && o.createdAt <= previousRange.maxTime,
    );
  }, [sourceOrders, previousRange]);
  const previousAnalytics = useMemo(
    () => (previousOrders ? computeAnalytics(previousOrders, preset) : null),
    [previousOrders, preset],
  );
  const comparison = useMemo(
    () => (previousAnalytics ? diffKPIs(analytics.kpis, previousAnalytics.kpis) : null),
    [analytics.kpis, previousAnalytics],
  );
  const comparisonCaption = COMPARISON_CAPTION[preset];

  // ── Per-item detail modal ──
  const [itemDetailModal, setItemDetailModal] = useState<ItemDetailModalState | null>(null);

  // Available categories in leaderboard
  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    analytics.itemLeaderboard.forEach((item) => set.add(item.category));
    return Array.from(set);
  }, [analytics.itemLeaderboard]);

  // Filter leaderboard based on user search & category pill
  const displayedItems = useMemo(() => {
    return analytics.itemLeaderboard.filter((it) => {
      const matchesSearch =
        it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === "All" || it.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [analytics.itemLeaderboard, searchQuery, selectedCategory]);

  // Data for Category breakdown pie/bar chart
  const categoryChartData = useMemo(() => {
    return Object.entries(analytics.categorizedRevenue).map(([cat, rev]) => ({
      name: cat,
      revenue: rev,
    }));
  }, [analytics.categorizedRevenue]);

  // Handle CSV Download
  const handleExportCSV = () => {
    const csvContent = exportOrdersToCSV(filteredOrders);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `rakus-kitchen-sales-${preset}-${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { kpis, timeSeries } = analytics;

  return (
    <div className="space-y-6">
      {/* ── Top Bar: Range selector & Export CSV ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm border border-stone-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 mr-2">
            Timeframe:
          </span>
          {(["today", "yesterday", "last7days", "monthToDate", "all"] as DateRangePreset[]).map(
            (p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  preset === p
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ),
          )}
        </div>

        {preset === "all" && allTimeLoading && (
          <span className="text-xs text-stone-500">Loading full order history…</span>
        )}
        {preset === "all" && allTimeError && (
          <span className="text-xs text-rose-600">{allTimeError}</span>
        )}

        <button
          onClick={handleExportCSV}
          disabled={filteredOrders.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-800 shadow-sm transition hover:bg-stone-50 disabled:opacity-40"
          title="Download accounting & audit CSV"
        >
          <svg className="h-4 w-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV ({filteredOrders.length} orders)
        </button>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Gross Revenue */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Gross Sales</span>
            <div className="flex items-center gap-1.5">
              {comparison && <ComparisonBadge comparison={comparison.grossRevenue} />}
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                ₹ Net
              </span>
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {formatINR(kpis.grossRevenue)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-stone-500">
            <span>AOV: {formatINR(kpis.averageOrderValue)}</span>
            <span className="text-stone-400">Pkg: {formatINR(kpis.totalPackagingRevenue)}</span>
          </div>
          {comparisonCaption && (
            <div className="mt-1 text-[10px] text-stone-400">{comparisonCaption}</div>
          )}
        </div>

        {/* Paid & Total Orders */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Paid Orders</span>
            <div className="flex items-center gap-1.5">
              {comparison && <ComparisonBadge comparison={comparison.paidOrdersCount} />}
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                {kpis.totalOrdersCount > 0
                  ? `${Math.round((kpis.paidOrdersCount / kpis.totalOrdersCount) * 100)}% Success`
                  : "0%"}
              </span>
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {kpis.paidOrdersCount}
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {kpis.cancelledOrdersCount > 0 ? (
              <span className="text-rose-600 font-medium">
                {kpis.cancelledOrdersCount} cancelled
              </span>
            ) : (
              <span className="text-stone-400">0 cancellations</span>
            )}
          </div>
          {comparisonCaption && (
            <div className="mt-1 text-[10px] text-stone-400">{comparisonCaption}</div>
          )}
        </div>

        {/* Meal Slot Distribution */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Meal Slots</span>
            <span className="text-[10px] font-medium text-stone-400">Lunch vs Dinner</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-stone-900">
              {kpis.mealSlots.lunchCount} <span className="text-xs font-normal text-stone-500">Lunch</span>
            </span>
            <span className="text-stone-300">/</span>
            <span className="text-xl font-bold text-stone-900">
              {kpis.mealSlots.dinnerCount} <span className="text-xs font-normal text-stone-500">Dinner</span>
            </span>
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {formatINR(kpis.mealSlots.lunchRevenue)} lunch · {formatINR(kpis.mealSlots.dinnerRevenue)} dinner
          </div>
        </div>

        {/* Fulfillment Split */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Fulfillment</span>
            <span className="text-[10px] font-medium text-stone-400">Delivery vs Pickup</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-stone-900">
              {kpis.fulfillment.deliveryPercent}% <span className="text-xs font-normal text-stone-500">Delivered</span>
            </span>
            <span className="text-stone-300">/</span>
            <span className="text-sm font-semibold text-stone-600">
              {kpis.fulfillment.pickupPercent}% <span className="text-xs font-normal text-stone-400">Pickup</span>
            </span>
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {kpis.extraMeatAddonCount > 0 ? (
              <span className="text-amber-700 font-medium">
                🥩 {kpis.extraMeatAddonCount} extra meat add-ons ({formatINR(kpis.extraMeatAddonRevenue)})
              </span>
            ) : (
              <span className="text-stone-400">No add-ons in this period</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Time-series Area Chart (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Revenue & Ordering Velocity</h3>
              <p className="text-xs text-stone-500">
                {preset === "today" || preset === "yesterday"
                  ? "Hourly sales breakdown"
                  : "Daily sales trajectory"}
              </p>
            </div>
            {kpis.topSellingDish && (
              <div className="hidden sm:block text-right">
                <span className="text-[10px] uppercase font-semibold text-stone-400">Top Dish</span>
                <div className="text-xs font-bold text-stone-800">
                  {kpis.topSellingDish.name} ({formatINR(kpis.topSellingDish.revenue)})
                </div>
              </div>
            )}
          </div>

          <div className="h-64 w-full">
            {timeSeries.length === 0 || kpis.paidOrdersCount === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-stone-400">
                No paid orders recorded for this timeframe.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#78716c" }}
                    axisLine={{ stroke: "#e7e5e4" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#78716c" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1c1917",
                      borderRadius: "12px",
                      border: "none",
                      color: "#fff",
                      fontSize: "12px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: any, name: any) => [
                      name === "revenue" ? formatINR(Number(value)) : value,
                      name === "revenue" ? "Sales" : "Orders",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#d97706"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Share Chart (1 col) */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Category Share</h3>
            <p className="text-xs text-stone-500">Revenue split across culinary specialities</p>
          </div>

          <div className="h-52 w-full my-auto">
            {categoryChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-stone-400">
                No category data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1c1917",
                      borderRadius: "10px",
                      color: "#fff",
                      fontSize: "11px",
                    }}
                    formatter={(val: any) => [formatINR(Number(val)), "Revenue"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Mini Category Legend */}
          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-stone-100 text-[11px]">
            {categoryChartData.map((cat, i) => (
              <div key={cat.name} className="flex items-center gap-1.5 truncate">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                />
                <span className="text-stone-600 truncate">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Dish & Item Performance Leaderboard ── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900">Item Performance Leaderboard</h3>
            <p className="text-xs text-stone-500">
              Quantities sold, weight prepared, revenue contribution, and variant breakdown.
            </p>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search dish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 focus:border-amber-500 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full text-left text-xs text-stone-600">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Dish</th>
                <th className="px-3 py-3 font-semibold">Category</th>
                <th className="px-3 py-3 font-semibold text-right">Units Sold</th>
                <th className="px-3 py-3 font-semibold text-right">Weight (Kg)</th>
                <th className="px-3 py-3 font-semibold text-right">Revenue</th>
                <th className="px-3 py-3 font-semibold text-right">Sales Share</th>
                <th className="px-4 py-3 font-semibold">Variant Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                    No dish sales matching filters for this timeframe.
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, idx) => (
                  <tr key={item.menuId} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-stone-900">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{item.emoji}</span>
                        <div>
                          <div className="font-semibold">{item.name}</div>
                          <div className="text-[10px] text-stone-400">
                            {item.totalOrders} {item.totalOrders === 1 ? "order" : "orders"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setItemDetailModal({ menuId: item.menuId, name: item.name, emoji: item.emoji })
                          }
                          className="ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-50 transition-colors"
                          title="View item performance deep-dive"
                        >
                          🔍 Details
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-stone-800">
                      {item.totalUnitsSold}
                    </td>
                    <td className="px-3 py-3 text-right text-stone-600">
                      {item.totalKgSold > 0 ? `${item.totalKgSold} kg` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-amber-700">
                      {formatINR(item.totalRevenue)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-medium text-stone-700">
                          {item.revenueSharePercent.toFixed(1)}%
                        </span>
                        <div className="w-12 h-1.5 rounded-full bg-stone-100 overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${Math.min(100, item.revenueSharePercent)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(item.variants).map(([vName, vData]) => (
                          <span
                            key={vName}
                            className="inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600"
                          >
                            <span className="font-medium">{vName}:</span> {vData.qty}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminItemDetailModal
        modal={itemDetailModal}
        onClose={() => setItemDetailModal(null)}
        orders={sourceOrders}
      />
    </div>
  );
}
