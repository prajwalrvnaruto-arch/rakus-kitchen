import type { FulfillmentType, MealSlot, Order, OrderLineItem, OrderStatus } from "@/types";
import { MENU, menuItemById, parseBiryaniWeight } from "./menu";
import { quantityInLimitUnits } from "./menuLimits";

export interface ItemPerformanceSummary {
  menuId: string;
  name: string;
  category: string;
  emoji: string;
  veg?: boolean;
  totalOrders: number;
  totalUnitsSold: number;
  totalKgSold: number;
  totalRevenue: number;
  revenueSharePercent: number;
  variants: Record<string, { qty: number; revenue: number }>;
}

export interface TimeSeriesDataPoint {
  key: string; // e.g. "12:00" or "2026-10-19"
  label: string; // "12 PM" or "19 Oct"
  revenue: number;
  orders: number;
  lunchOrders: number;
  dinnerOrders: number;
  deliveryOrders: number;
  pickupOrders: number;
}

export interface AnalyticsKPIs {
  grossRevenue: number;
  paidOrdersCount: number;
  cancelledOrdersCount: number;
  totalOrdersCount: number;
  averageOrderValue: number;
  totalPackagingRevenue: number;
  fulfillment: {
    deliveryCount: number;
    pickupCount: number;
    deliveryPercent: number;
    pickupPercent: number;
  };
  mealSlots: {
    lunchCount: number;
    dinnerCount: number;
    lunchRevenue: number;
    dinnerRevenue: number;
  };
  topSellingDish?: {
    name: string;
    revenue: number;
    units: number;
  };
  extraMeatAddonCount: number;
  extraMeatAddonRevenue: number;
}

export interface AnalyticsSummary {
  kpis: AnalyticsKPIs;
  timeSeries: TimeSeriesDataPoint[];
  itemLeaderboard: ItemPerformanceSummary[];
  categorizedRevenue: Record<string, number>;
}

export type DateRangePreset = "today" | "yesterday" | "last7days" | "monthToDate" | "all";

/** One dish's trend-chart row for the per-item detail view (see computeItemDetail). */
export interface ItemDailyTrendPoint {
  date: string; // YYYY-MM-DD
  label: string; // "19 Oct"
  unitsSold: number;
  revenue: number;
}

/** Another item frequently found in the same order as the dish being inspected. */
export interface ItemCoOrderedEntry {
  menuId: string;
  name: string;
  emoji: string;
  coOrderCount: number; // distinct orders containing both items
}

/** Per-item deep-dive data: own trend over time, peak day(s), and co-ordered items. */
export interface ItemDetail {
  menuId: string;
  name: string;
  emoji: string;
  category: string;
  totalOrders: number;
  totalUnitsSold: number;
  totalRevenue: number;
  dailyTrend: ItemDailyTrendPoint[]; // chronological, only days with >=1 order
  peakDays: ItemDailyTrendPoint[]; // day(s) tied for the highest unitsSold
  coOrderedItems: ItemCoOrderedEntry[]; // sorted desc by coOrderCount, top 5
}

/** A current-vs-previous-period figure, with a percent-change that's never Infinity/NaN. */
export interface KPIComparison {
  current: number;
  previous: number;
  /** null when there's nothing meaningful to show as a %: both periods are 0,
   *  or previous is 0 and current > 0 (see `isNew` for that case instead). */
  percentChange: number | null;
  /** true when previous was 0 and current > 0 — "new activity," not a %. */
  isNew: boolean;
}

/**
 * Computes the inclusive [minTime, maxTime] epoch-ms bounds for a date range
 * preset (or an explicit custom start/end). Returns null for "all" with no
 * custom range, meaning "unbounded — don't filter at all".
 *
 * Pulled out of filterOrdersByDate so the same date math can also drive a
 * server-side Firestore range query (see fetchOrdersInRange in db.ts) —
 * the Analytics tab fetches its own range directly from Firestore instead
 * of relying on the live dashboard listener, which is capped to the most
 * recent orders only (see subscribeAllOrders).
 */
export function getPresetRange(
  preset: DateRangePreset,
  now: Date = new Date(),
  customStart?: Date,
  customEnd?: Date,
): { minTime: number; maxTime: number } | null {
  if (preset === "all" && !customStart && !customEnd) {
    return null;
  }

  const startOfDay = (d: Date) => {
    const res = new Date(d);
    res.setHours(0, 0, 0, 0);
    return res.getTime();
  };

  const endOfDay = (d: Date) => {
    const res = new Date(d);
    res.setHours(23, 59, 59, 999);
    return res.getTime();
  };

  if (preset === "today") {
    return { minTime: startOfDay(now), maxTime: endOfDay(now) };
  }
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { minTime: startOfDay(y), maxTime: endOfDay(y) };
  }
  if (preset === "last7days") {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    return { minTime: startOfDay(sevenDaysAgo), maxTime: endOfDay(now) };
  }
  if (preset === "monthToDate") {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { minTime: startOfDay(firstDay), maxTime: endOfDay(now) };
  }
  if (customStart && customEnd) {
    return { minTime: startOfDay(customStart), maxTime: endOfDay(customEnd) };
  }

  return { minTime: 0, maxTime: Infinity };
}

/**
 * Date range for the period immediately preceding a preset's current range —
 * the standard preset-vs-its-own-predecessor comparison: today vs yesterday,
 * last7days vs the prior 7 days, monthToDate vs the same elapsed days of the
 * previous month. Returns null for "all" (no previous period exists) and
 * "yesterday" (no defined predecessor in the supported preset set) — callers
 * must treat null as "don't show a comparison," never as a zero-value one.
 */
export function getPreviousPeriodRange(
  preset: DateRangePreset,
  now: Date = new Date(),
): { minTime: number; maxTime: number } | null {
  const startOfDay = (d: Date) => {
    const res = new Date(d);
    res.setHours(0, 0, 0, 0);
    return res.getTime();
  };

  const endOfDay = (d: Date) => {
    const res = new Date(d);
    res.setHours(23, 59, 59, 999);
    return res.getTime();
  };

  if (preset === "today") {
    return getPresetRange("yesterday", now);
  }

  if (preset === "last7days") {
    // Current window is [now-6d, now] (7 days inclusive). Previous is the
    // preceding 7-day block, [now-13d, now-7d].
    const prevEnd = new Date(now);
    prevEnd.setDate(prevEnd.getDate() - 7);
    const prevStart = new Date(now);
    prevStart.setDate(prevStart.getDate() - 13);
    return { minTime: startOfDay(prevStart), maxTime: endOfDay(prevEnd) };
  }

  if (preset === "monthToDate") {
    // Current window is [firstOfMonth, now]. Previous is the same
    // elapsed-day count in the prior calendar month — native Date rollover
    // handles month-length differences (e.g. Mar 1 → correctly lands in Feb).
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(prevStart);
    prevEnd.setDate(prevEnd.getDate() + (now.getDate() - 1));
    return { minTime: startOfDay(prevStart), maxTime: endOfDay(prevEnd) };
  }

  // "yesterday" has no defined predecessor among the supported presets;
  // "all" has no previous period by definition.
  return null;
}

/**
 * Filter orders by date range preset or explicit start/end timestamps (inclusive).
 * Uses order.createdAt (epoch ms) or order.mealDate.
 */
export function filterOrdersByDate(
  orders: Order[],
  preset: DateRangePreset,
  customStart?: Date,
  customEnd?: Date,
  now: Date = new Date(),
): Order[] {
  const range = getPresetRange(preset, now, customStart, customEnd);
  if (!range) return orders;
  return orders.filter((o) => o.createdAt >= range.minTime && o.createdAt <= range.maxTime);
}

/**
 * Checks whether an order is considered paid / revenue-eligible.
 * Excludes cancelled orders and unverified payments.
 */
export function isPaidOrder(order: Order): boolean {
  if (order.status === "Cancelled") return false;
  // If payment meta is present, ensure it's not failed
  if (order.payment && order.payment.status === "failed") return false;
  return true;
}

/**
 * Computes all analytics aggregations, KPIs, time series and dish leaderboards.
 */
export function computeAnalytics(
  orders: Order[],
  preset: DateRangePreset = "all",
): AnalyticsSummary {
  let grossRevenue = 0;
  let paidOrdersCount = 0;
  let cancelledOrdersCount = 0;
  let totalPackagingRevenue = 0;

  let deliveryCount = 0;
  let pickupCount = 0;

  let lunchCount = 0;
  let dinnerCount = 0;
  let lunchRevenue = 0;
  let dinnerRevenue = 0;

  let extraMeatAddonCount = 0;
  let extraMeatAddonRevenue = 0;

  const itemMap = new Map<string, ItemPerformanceSummary>();
  const categorizedRevenue: Record<string, number> = {};

  // Initialize all known menu items into leaderboard so zero-selling items are also trackable if needed
  for (const it of MENU) {
    itemMap.set(it.id, {
      menuId: it.id,
      name: it.name,
      category: it.category,
      emoji: it.emoji,
      veg: it.veg,
      totalOrders: 0,
      totalUnitsSold: 0,
      totalKgSold: 0,
      totalRevenue: 0,
      revenueSharePercent: 0,
      variants: {},
    });
  }

  // Pre-seed addon items
  const addonIds = ["extra-chicken-250g", "extra-mutton-250g"];
  for (const aId of addonIds) {
    itemMap.set(aId, {
      menuId: aId,
      name: aId === "extra-chicken-250g" ? "Extra Chicken (250g)" : "Extra Mutton (250g)",
      category: "Add-ons",
      emoji: "🥩",
      veg: false,
      totalOrders: 0,
      totalUnitsSold: 0,
      totalKgSold: 0,
      totalRevenue: 0,
      revenueSharePercent: 0,
      variants: {},
    });
  }

  // Time-series buckets
  const isSingleDay = preset === "today" || preset === "yesterday";
  const timeBuckets = new Map<string, TimeSeriesDataPoint>();

  if (isSingleDay) {
    // 24 hourly buckets: 00 to 23
    for (let h = 0; h < 24; h++) {
      const key = `${h.toString().padStart(2, "0")}:00`;
      const ampm = h >= 12 ? (h === 12 ? "12 PM" : `${h - 12} PM`) : h === 0 ? "12 AM" : `${h} AM`;
      timeBuckets.set(key, {
        key,
        label: ampm,
        revenue: 0,
        orders: 0,
        lunchOrders: 0,
        dinnerOrders: 0,
        deliveryOrders: 0,
        pickupOrders: 0,
      });
    }
  }

  for (const order of orders) {
    if (order.status === "Cancelled") {
      cancelledOrdersCount++;
      continue;
    }

    if (!isPaidOrder(order)) continue;

    paidOrdersCount++;
    const orderTotal = order.grandTotal || 0;
    grossRevenue += orderTotal;
    totalPackagingRevenue += order.packagingFee || 0;

    // Fulfillment
    if (order.fulfillmentType === "pickup") {
      pickupCount++;
    } else {
      deliveryCount++;
    }

    // Meal slot
    if (order.mealSlot === "Lunch") {
      lunchCount++;
      lunchRevenue += orderTotal;
    } else {
      dinnerCount++;
      dinnerRevenue += orderTotal;
    }

    // Time-series binning
    const orderDate = new Date(order.createdAt || Date.now());
    let bucketKey = "";
    let bucketLabel = "";

    if (isSingleDay) {
      const h = orderDate.getHours();
      bucketKey = `${h.toString().padStart(2, "0")}:00`;
    } else {
      // YYYY-MM-DD
      bucketKey = orderDate.toISOString().slice(0, 10);
      bucketLabel = orderDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    }

    if (!timeBuckets.has(bucketKey)) {
      timeBuckets.set(bucketKey, {
        key: bucketKey,
        label: bucketLabel || bucketKey,
        revenue: 0,
        orders: 0,
        lunchOrders: 0,
        dinnerOrders: 0,
        deliveryOrders: 0,
        pickupOrders: 0,
      });
    }

    const bucket = timeBuckets.get(bucketKey)!;
    bucket.revenue += orderTotal;
    bucket.orders += 1;
    if (order.mealSlot === "Lunch") bucket.lunchOrders += 1;
    else bucket.dinnerOrders += 1;

    if (order.fulfillmentType === "pickup") bucket.pickupOrders += 1;
    else bucket.deliveryOrders += 1;

    // Aggregate items
    for (const line of order.items || []) {
      const lineTotal = line.lineTotal || line.qty * line.pricePerUnit;
      let perf = itemMap.get(line.menuId);

      if (!perf) {
        perf = {
          menuId: line.menuId,
          name: line.name,
          category: "Other",
          emoji: "🍲",
          totalOrders: 0,
          totalUnitsSold: 0,
          totalKgSold: 0,
          totalRevenue: 0,
          revenueSharePercent: 0,
          variants: {},
        };
        itemMap.set(line.menuId, perf);
      }

      perf.totalOrders += 1;
      perf.totalUnitsSold += line.qty;
      perf.totalRevenue += lineTotal;

      // Track weight in kg if applicable
      const kgWeight = quantityInLimitUnits(line.menuId, line.variant, line.qty);
      perf.totalKgSold += kgWeight;

      // Variants breakdown
      const vKey = line.variant || "Standard";
      if (!perf.variants[vKey]) {
        perf.variants[vKey] = { qty: 0, revenue: 0 };
      }
      perf.variants[vKey].qty += line.qty;
      perf.variants[vKey].revenue += lineTotal;

      // Category revenue breakdown
      categorizedRevenue[perf.category] = (categorizedRevenue[perf.category] || 0) + lineTotal;

      // Add-on tracking
      if (line.menuId.startsWith("extra-")) {
        extraMeatAddonCount += line.qty;
        extraMeatAddonRevenue += lineTotal;
      }
    }
  }

  // Calculate percentages and sort leaderboard
  const allLeaderboardItems = Array.from(itemMap.values());
  for (const it of allLeaderboardItems) {
    it.revenueSharePercent = grossRevenue > 0 ? (it.totalRevenue / grossRevenue) * 100 : 0;
  }

  // Only return items with sales > 0, sorted by total revenue desc
  const activeLeaderboard = allLeaderboardItems
    .filter((it) => it.totalUnitsSold > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const topSellingDish = activeLeaderboard.length > 0
    ? {
        name: activeLeaderboard[0].name,
        revenue: activeLeaderboard[0].totalRevenue,
        units: activeLeaderboard[0].totalUnitsSold,
      }
    : undefined;

  const totalOrders = paidOrdersCount + cancelledOrdersCount;
  const aov = paidOrdersCount > 0 ? Math.round(grossRevenue / paidOrdersCount) : 0;

  // Convert timeBuckets map to array and sort chronologically
  const timeSeries = Array.from(timeBuckets.values()).sort((a, b) => a.key.localeCompare(b.key));

  return {
    kpis: {
      grossRevenue,
      paidOrdersCount,
      cancelledOrdersCount,
      totalOrdersCount: totalOrders,
      averageOrderValue: aov,
      totalPackagingRevenue,
      fulfillment: {
        deliveryCount,
        pickupCount,
        deliveryPercent: paidOrdersCount > 0 ? Math.round((deliveryCount / paidOrdersCount) * 100) : 0,
        pickupPercent: paidOrdersCount > 0 ? Math.round((pickupCount / paidOrdersCount) * 100) : 0,
      },
      mealSlots: {
        lunchCount,
        dinnerCount,
        lunchRevenue,
        dinnerRevenue,
      },
      topSellingDish,
      extraMeatAddonCount,
      extraMeatAddonRevenue,
    },
    timeSeries,
    itemLeaderboard: activeLeaderboard,
    categorizedRevenue,
  };
}

/** Percent-change helper used by diffKPIs — never returns Infinity/NaN. */
function pctChange(curr: number, prev: number): KPIComparison {
  if (prev === 0 && curr === 0) {
    return { current: curr, previous: prev, percentChange: null, isNew: false };
  }
  if (prev === 0 && curr > 0) {
    return { current: curr, previous: prev, percentChange: null, isNew: true };
  }
  return { current: curr, previous: prev, percentChange: ((curr - prev) / prev) * 100, isNew: false };
}

/**
 * Diffs the headline KPIs between a current and a previous AnalyticsSummary
 * (see getPreviousPeriodRange for how the previous window is chosen). Only
 * the 4 fields shown on the existing KPI cards are compared.
 */
export function diffKPIs(
  current: AnalyticsKPIs,
  previous: AnalyticsKPIs,
): {
  grossRevenue: KPIComparison;
  paidOrdersCount: KPIComparison;
  averageOrderValue: KPIComparison;
  totalPackagingRevenue: KPIComparison;
} {
  return {
    grossRevenue: pctChange(current.grossRevenue, previous.grossRevenue),
    paidOrdersCount: pctChange(current.paidOrdersCount, previous.paidOrdersCount),
    averageOrderValue: pctChange(current.averageOrderValue, previous.averageOrderValue),
    totalPackagingRevenue: pctChange(current.totalPackagingRevenue, previous.totalPackagingRevenue),
  };
}

/** Addon menuIds live outside MENU — shared metadata so computeAnalytics and
 *  computeItemDetail don't each hand-maintain their own copy. */
function resolveItemMeta(menuId: string, fallbackName: string): { name: string; emoji: string; category: string } {
  const menuItem = menuItemById(menuId);
  if (menuItem) {
    return { name: menuItem.name, emoji: menuItem.emoji, category: menuItem.category };
  }
  if (menuId === "extra-chicken-250g") {
    return { name: "Extra Chicken (250g)", emoji: "🥩", category: "Add-ons" };
  }
  if (menuId === "extra-mutton-250g") {
    return { name: "Extra Mutton (250g)", emoji: "🥩", category: "Add-ons" };
  }
  return { name: fallbackName, emoji: "🍲", category: "Other" };
}

/**
 * Per-item deep-dive: this dish's own daily trend, peak order day(s), and
 * which other items are most commonly ordered alongside it. Takes whatever
 * `orders` array the caller passes — deliberately does no date filtering of
 * its own, so callers can feed it full lifetime data even while the rest of
 * the dashboard is viewing a narrow preset. Returns null only if `menuId`
 * never appears in any order in the given array.
 */
export function computeItemDetail(orders: Order[], menuId: string): ItemDetail | null {
  const dailyBuckets = new Map<string, ItemDailyTrendPoint>();
  const coOrderCounts = new Map<string, { name: string; emoji: string; count: number }>();

  let totalOrders = 0;
  let totalUnitsSold = 0;
  let totalRevenue = 0;
  let seenAtAll = false;
  let meta: { name: string; emoji: string; category: string } | null = null;

  for (const order of orders) {
    if (order.status === "Cancelled") continue;
    if (!isPaidOrder(order)) continue;

    const matchingLines = (order.items || []).filter((line) => line.menuId === menuId);
    if (matchingLines.length === 0) continue;

    seenAtAll = true;
    if (!meta) {
      meta = resolveItemMeta(menuId, matchingLines[0].name);
    }

    let orderUnits = 0;
    let orderRevenue = 0;
    for (const line of matchingLines) {
      const lineTotal = line.lineTotal || line.qty * line.pricePerUnit;
      orderUnits += line.qty;
      orderRevenue += lineTotal;
    }

    totalOrders += 1;
    totalUnitsSold += orderUnits;
    totalRevenue += orderRevenue;

    const dateKey = new Date(order.createdAt || Date.now()).toISOString().slice(0, 10);
    let bucket = dailyBuckets.get(dateKey);
    if (!bucket) {
      const label = new Date(order.createdAt || Date.now()).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
      bucket = { date: dateKey, label, unitsSold: 0, revenue: 0 };
      dailyBuckets.set(dateKey, bucket);
    }
    bucket.unitsSold += orderUnits;
    bucket.revenue += orderRevenue;

    // Co-ordered items: dedupe other distinct menuIds within this order first,
    // so multiple variant-lines of the same other item count once per order.
    const otherIdsInOrder = new Set<string>();
    for (const line of order.items || []) {
      if (line.menuId !== menuId) otherIdsInOrder.add(line.menuId);
    }
    for (const otherId of Array.from(otherIdsInOrder)) {
      const existing = coOrderCounts.get(otherId);
      if (existing) {
        existing.count += 1;
      } else {
        const otherLine = (order.items || []).find((l) => l.menuId === otherId);
        const otherMeta = resolveItemMeta(otherId, otherLine?.name || otherId);
        coOrderCounts.set(otherId, { name: otherMeta.name, emoji: otherMeta.emoji, count: 1 });
      }
    }
  }

  if (!seenAtAll || !meta) return null;

  const dailyTrend = Array.from(dailyBuckets.values()).sort((a, b) => a.date.localeCompare(b.date));
  const maxUnits = dailyTrend.reduce((max, d) => Math.max(max, d.unitsSold), 0);
  const peakDays = dailyTrend.filter((d) => d.unitsSold === maxUnits && maxUnits > 0);

  const coOrderedItems: ItemCoOrderedEntry[] = Array.from(coOrderCounts.entries())
    .map(([otherMenuId, v]) => ({ menuId: otherMenuId, name: v.name, emoji: v.emoji, coOrderCount: v.count }))
    .sort((a, b) => b.coOrderCount - a.coOrderCount)
    .slice(0, 5);

  return {
    menuId,
    name: meta.name,
    emoji: meta.emoji,
    category: meta.category,
    totalOrders,
    totalUnitsSold,
    totalRevenue,
    dailyTrend,
    peakDays,
    coOrderedItems,
  };
}

/**
 * Generates CSV string for bookkeeping and auditor export.
 */
export function exportOrdersToCSV(orders: Order[]): string {
  const headers = [
    "Order ID",
    "Date",
    "Time",
    "Customer Name",
    "Phone",
    "Fulfillment",
    "Meal Slot",
    "Items Summary",
    "Item Total (INR)",
    "Packaging (INR)",
    "Grand Total (INR)",
    "Payment Status",
    "Razorpay Payment ID",
    "Order Status",
  ];

  const rows = orders.map((o) => {
    const d = new Date(o.createdAt || Date.now());
    const dateStr = d.toLocaleDateString("en-IN");
    const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const itemsSummary = o.items
      .map((it) => `${it.qty}x ${it.name}${it.variant ? ` (${it.variant})` : ""}`)
      .join("; ");

    return [
      `"${o.orderId}"`,
      `"${dateStr}"`,
      `"${timeStr}"`,
      `"${(o.customerName || "").replace(/"/g, '""')}"`,
      `"${o.phone || ""}"`,
      `"${o.fulfillmentType || "delivery"}"`,
      `"${o.mealSlot || ""}"`,
      `"${itemsSummary.replace(/"/g, '""')}"`,
      o.itemTotal || 0,
      o.packagingFee || 0,
      o.grandTotal || 0,
      `"${o.payment?.status || (o.status === "Cancelled" ? "cancelled" : "paid")}"`,
      `"${o.payment?.razorpayPaymentId || ""}"`,
      `"${o.status}"`,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
