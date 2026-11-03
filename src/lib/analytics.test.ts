import { describe, expect, it } from "vitest";
import {
  computeAnalytics,
  computeItemDetail,
  diffKPIs,
  exportOrdersToCSV,
  filterOrdersByDate,
  getPresetRange,
  getPreviousPeriodRange,
  type DateRangePreset,
} from "./analytics";
import type { Order } from "@/types";

function mockOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "test-order-1",
    orderId: "RK-00001",
    customerId: "cust-1",
    customerName: "Prajwal V",
    phone: "9876543210",
    deliveryAddress: "Koramangala, Bengaluru",
    fulfillmentType: "delivery",
    mealSlot: "Lunch",
    mealDate: "2026-10-19",
    items: [
      {
        menuId: "biryani-chicken",
        name: "Chicken Biryani",
        variant: "1 kg · Chicken",
        qty: 2,
        pricePerUnit: 799,
        lineTotal: 1598,
      },
      {
        menuId: "extra-chicken-250g",
        name: "Extra Chicken (250 g)",
        qty: 1,
        pricePerUnit: 200,
        lineTotal: 200,
      },
    ],
    itemTotal: 1798,
    packagingFee: 60,
    grandTotal: 1858,
    status: "Delivered",
    statusHistory: [],
    payment: {
      provider: "razorpay",
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      amount: 185800,
      currency: "INR",
      status: "paid",
      createdAt: 1729324800000,
    },
    createdAt: 1729324800000, // 2024-10-19T08:00:00Z
    updatedAt: 1729324800000,
    ...overrides,
  };
}

describe("analytics calculations", () => {
  it("handles empty order set gracefully", () => {
    const summary = computeAnalytics([], "all");
    expect(summary.kpis.grossRevenue).toBe(0);
    expect(summary.kpis.paidOrdersCount).toBe(0);
    expect(summary.kpis.averageOrderValue).toBe(0);
    expect(summary.itemLeaderboard).toEqual([]);
    expect(summary.timeSeries).toEqual([]);
  });

  it("computes KPIs and item leaderboard correctly for paid orders", () => {
    const order1 = mockOrder({
      id: "ord-1",
      orderId: "RK-00001",
      grandTotal: 1000,
      packagingFee: 40,
      fulfillmentType: "delivery",
      mealSlot: "Lunch",
    });

    const order2 = mockOrder({
      id: "ord-2",
      orderId: "RK-00002",
      grandTotal: 1500,
      packagingFee: 60,
      fulfillmentType: "pickup",
      mealSlot: "Dinner",
      items: [
        {
          menuId: "biryani-mutton",
          name: "Mutton Biryani",
          variant: "½ kg · Mutton",
          qty: 1,
          pricePerUnit: 799,
          lineTotal: 799,
        },
      ],
    });

    const orderCancelled = mockOrder({
      id: "ord-3",
      orderId: "RK-00003",
      status: "Cancelled",
      grandTotal: 2000,
    });

    const summary = computeAnalytics([order1, order2, orderCancelled], "all");

    // Cancelled order is excluded from gross revenue and paid count
    expect(summary.kpis.grossRevenue).toBe(2500);
    expect(summary.kpis.paidOrdersCount).toBe(2);
    expect(summary.kpis.cancelledOrdersCount).toBe(1);
    expect(summary.kpis.averageOrderValue).toBe(1250);
    expect(summary.kpis.totalPackagingRevenue).toBe(100);

    // Fulfillment split
    expect(summary.kpis.fulfillment.deliveryCount).toBe(1);
    expect(summary.kpis.fulfillment.pickupCount).toBe(1);
    expect(summary.kpis.fulfillment.deliveryPercent).toBe(50);
    expect(summary.kpis.fulfillment.pickupPercent).toBe(50);

    // Meal slot split
    expect(summary.kpis.mealSlots.lunchCount).toBe(1);
    expect(summary.kpis.mealSlots.dinnerCount).toBe(1);
    expect(summary.kpis.mealSlots.lunchRevenue).toBe(1000);
    expect(summary.kpis.mealSlots.dinnerRevenue).toBe(1500);

    // Add-on extra meat counted
    expect(summary.kpis.extraMeatAddonCount).toBe(1);
    expect(summary.kpis.extraMeatAddonRevenue).toBe(200);

    // Leaderboard sorted by revenue
    expect(summary.itemLeaderboard.length).toBeGreaterThanOrEqual(2);
    expect(summary.itemLeaderboard[0].menuId).toBe("biryani-chicken");
    expect(summary.itemLeaderboard[0].totalRevenue).toBe(1598);
    expect(summary.itemLeaderboard[0].totalKgSold).toBe(2); // 1kg * 2
  });

  it("filters orders by date presets accurately", () => {
    const fixedNow = new Date("2026-10-19T12:00:00Z");
    const todayOrder = mockOrder({ createdAt: fixedNow.getTime() });

    const yesterdayDate = new Date("2026-10-18T12:00:00Z");
    const yesterdayOrder = mockOrder({ createdAt: yesterdayDate.getTime() });

    const lastWeekDate = new Date("2026-10-10T12:00:00Z");
    const oldOrder = mockOrder({ createdAt: lastWeekDate.getTime() });

    const orders = [todayOrder, yesterdayOrder, oldOrder];

    const todayFiltered = filterOrdersByDate(orders, "today", undefined, undefined, fixedNow);
    expect(todayFiltered).toHaveLength(1);
    expect(todayFiltered[0].createdAt).toBe(todayOrder.createdAt);

    const yesterdayFiltered = filterOrdersByDate(orders, "yesterday", undefined, undefined, fixedNow);
    expect(yesterdayFiltered).toHaveLength(1);
    expect(yesterdayFiltered[0].createdAt).toBe(yesterdayOrder.createdAt);

    const last7Filtered = filterOrdersByDate(orders, "last7days", undefined, undefined, fixedNow);
    expect(last7Filtered).toHaveLength(2); // today + yesterday
  });

  it("exports orders to properly escaped CSV format", () => {
    const order = mockOrder();
    const csv = exportOrdersToCSV([order]);
    expect(csv).toContain("Order ID,Date,Time");
    expect(csv).toContain('"RK-00001"');
    expect(csv).toContain('"Prajwal V"');
    expect(csv).toContain("1858");
  });
});

// Formats a Date using its LOCAL date components (not UTC) — matches the
// local-time arithmetic (setHours/setDate/getDate) that getPresetRange and
// getPreviousPeriodRange both use internally.
function localYMD(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("getPreviousPeriodRange", () => {
  it("returns yesterday's range for 'today'", () => {
    const fixedNow = new Date(2026, 9, 19, 12, 0, 0); // Oct 19, 2026 local
    const prev = getPreviousPeriodRange("today", fixedNow);
    const expected = getPresetRange("yesterday", fixedNow);
    expect(prev).toEqual(expected);
  });

  it("returns null for 'yesterday'", () => {
    expect(getPreviousPeriodRange("yesterday", new Date(2026, 9, 19, 12, 0, 0))).toBeNull();
  });

  it("returns null for 'all'", () => {
    expect(getPreviousPeriodRange("all", new Date(2026, 9, 19, 12, 0, 0))).toBeNull();
  });

  it("returns the preceding 7-day block for 'last7days'", () => {
    const fixedNow = new Date(2026, 9, 19, 12, 0, 0); // current window: Oct 13-19
    const prev = getPreviousPeriodRange("last7days", fixedNow);
    expect(prev).not.toBeNull();
    expect(localYMD(new Date(prev!.minTime))).toBe("2026-10-06");
    expect(localYMD(new Date(prev!.maxTime))).toBe("2026-10-12");
  });

  it("returns the same elapsed-day count in the prior month for 'monthToDate'", () => {
    const fixedNow = new Date(2026, 9, 19, 12, 0, 0); // 19 days into October
    const prev = getPreviousPeriodRange("monthToDate", fixedNow);
    expect(prev).not.toBeNull();
    expect(localYMD(new Date(prev!.minTime))).toBe("2026-09-01");
    expect(localYMD(new Date(prev!.maxTime))).toBe("2026-09-19");
  });

  it("handles month rollover correctly (March 1st -> February)", () => {
    const fixedNow = new Date(2026, 2, 1, 12, 0, 0); // 1 day into March
    const prev = getPreviousPeriodRange("monthToDate", fixedNow);
    expect(prev).not.toBeNull();
    expect(localYMD(new Date(prev!.minTime))).toBe("2026-02-01");
    expect(localYMD(new Date(prev!.maxTime))).toBe("2026-02-01");
  });
});

describe("diffKPIs", () => {
  function kpis(overrides: Partial<ReturnType<typeof computeAnalytics>["kpis"]> = {}) {
    return computeAnalytics([], "all").kpis as any; // base zeroed KPIs object shape
    void overrides;
  }

  it("computes a positive percent change when current exceeds previous", () => {
    const current = { ...kpis(), grossRevenue: 1500, paidOrdersCount: 15, averageOrderValue: 100, totalPackagingRevenue: 150 };
    const previous = { ...kpis(), grossRevenue: 1000, paidOrdersCount: 10, averageOrderValue: 100, totalPackagingRevenue: 100 };
    const diff = diffKPIs(current, previous);
    expect(diff.grossRevenue.percentChange).toBe(50);
    expect(diff.grossRevenue.isNew).toBe(false);
    expect(diff.paidOrdersCount.percentChange).toBe(50);
  });

  it("computes a negative percent change when current is below previous", () => {
    const current = { ...kpis(), grossRevenue: 500 };
    const previous = { ...kpis(), grossRevenue: 1000 };
    const diff = diffKPIs(current, previous);
    expect(diff.grossRevenue.percentChange).toBe(-50);
  });

  it("returns percentChange: null (not Infinity/NaN) when both periods are zero", () => {
    const current = kpis();
    const previous = kpis();
    const diff = diffKPIs(current, previous);
    expect(diff.grossRevenue.percentChange).toBeNull();
    expect(diff.grossRevenue.isNew).toBe(false);
    expect(diff.grossRevenue.percentChange).not.toBe(Infinity);
    expect(Number.isNaN(diff.grossRevenue.percentChange)).toBe(false);
  });

  it("marks isNew: true (percentChange null, not Infinity) when previous is zero and current is positive", () => {
    const current = { ...kpis(), grossRevenue: 500 };
    const previous = kpis();
    const diff = diffKPIs(current, previous);
    expect(diff.grossRevenue.percentChange).toBeNull();
    expect(diff.grossRevenue.isNew).toBe(true);
    expect(diff.grossRevenue.percentChange).not.toBe(Infinity);
  });

  it("includes all 4 expected comparison fields", () => {
    const diff = diffKPIs(kpis(), kpis());
    expect(diff).toHaveProperty("grossRevenue");
    expect(diff).toHaveProperty("paidOrdersCount");
    expect(diff).toHaveProperty("averageOrderValue");
    expect(diff).toHaveProperty("totalPackagingRevenue");
  });
});

describe("computeItemDetail", () => {
  it("returns null for a menuId that appears in zero orders", () => {
    const order = mockOrder();
    expect(computeItemDetail([order], "nonexistent-item")).toBeNull();
  });

  it("aggregates totals across multiple orders on different days for one menuId", () => {
    const day1 = mockOrder({
      id: "d1",
      orderId: "RK-00010",
      createdAt: new Date("2026-10-10T08:00:00Z").getTime(),
      items: [
        { menuId: "biryani-chicken", name: "Chicken Biryani", variant: "1 kg · Chicken", qty: 2, pricePerUnit: 799, lineTotal: 1598 },
      ],
    });
    const day2 = mockOrder({
      id: "d2",
      orderId: "RK-00011",
      createdAt: new Date("2026-10-11T08:00:00Z").getTime(),
      items: [
        { menuId: "biryani-chicken", name: "Chicken Biryani", variant: "1 kg · Chicken", qty: 1, pricePerUnit: 799, lineTotal: 799 },
      ],
    });

    const detail = computeItemDetail([day1, day2], "biryani-chicken");
    expect(detail).not.toBeNull();
    expect(detail!.totalOrders).toBe(2);
    expect(detail!.totalUnitsSold).toBe(3);
    expect(detail!.totalRevenue).toBe(2397);
    expect(detail!.dailyTrend.map((d) => d.date)).toEqual(["2026-10-10", "2026-10-11"]);
  });

  it("identifies peak day(s), including ties", () => {
    const dayLow = mockOrder({
      id: "low",
      orderId: "RK-00020",
      createdAt: new Date("2026-10-10T08:00:00Z").getTime(),
      items: [{ menuId: "biryani-chicken", name: "Chicken Biryani", qty: 1, pricePerUnit: 799, lineTotal: 799 }],
    });
    const dayHighA = mockOrder({
      id: "highA",
      orderId: "RK-00021",
      createdAt: new Date("2026-10-11T08:00:00Z").getTime(),
      items: [{ menuId: "biryani-chicken", name: "Chicken Biryani", qty: 5, pricePerUnit: 799, lineTotal: 3995 }],
    });
    const dayHighB = mockOrder({
      id: "highB",
      orderId: "RK-00022",
      createdAt: new Date("2026-10-12T08:00:00Z").getTime(),
      items: [{ menuId: "biryani-chicken", name: "Chicken Biryani", qty: 5, pricePerUnit: 799, lineTotal: 3995 }],
    });

    const detail = computeItemDetail([dayLow, dayHighA, dayHighB], "biryani-chicken");
    expect(detail!.peakDays).toHaveLength(2);
    expect(detail!.peakDays.map((d) => d.date).sort()).toEqual(["2026-10-11", "2026-10-12"]);
  });

  it("excludes cancelled and failed-payment orders", () => {
    const paidOrder = mockOrder({
      id: "paid",
      orderId: "RK-00030",
      createdAt: new Date("2026-10-10T08:00:00Z").getTime(),
      items: [{ menuId: "biryani-chicken", name: "Chicken Biryani", qty: 1, pricePerUnit: 799, lineTotal: 799 }],
    });
    const cancelledOrder = mockOrder({
      id: "cancelled",
      orderId: "RK-00031",
      status: "Cancelled",
      createdAt: new Date("2026-10-11T08:00:00Z").getTime(),
      items: [{ menuId: "biryani-chicken", name: "Chicken Biryani", qty: 10, pricePerUnit: 799, lineTotal: 7990 }],
    });

    const detail = computeItemDetail([paidOrder, cancelledOrder], "biryani-chicken");
    expect(detail!.totalOrders).toBe(1);
    expect(detail!.totalUnitsSold).toBe(1);
    expect(detail!.totalRevenue).toBe(799);
  });

  it("dedupes multiple variant-lines of the same co-ordered item within a single order", () => {
    const order = mockOrder({
      id: "multi-variant",
      orderId: "RK-00040",
      items: [
        { menuId: "biryani-chicken", name: "Chicken Biryani", qty: 1, pricePerUnit: 799, lineTotal: 799 },
        { menuId: "biryani-mutton", name: "Mutton Biryani", variant: "½ kg", qty: 1, pricePerUnit: 799, lineTotal: 799 },
        { menuId: "biryani-mutton", name: "Mutton Biryani", variant: "1 kg", qty: 1, pricePerUnit: 1599, lineTotal: 1599 },
      ],
    });

    const detail = computeItemDetail([order], "biryani-chicken");
    const muttonEntry = detail!.coOrderedItems.find((e) => e.menuId === "biryani-mutton");
    expect(muttonEntry).toBeDefined();
    expect(muttonEntry!.coOrderCount).toBe(1); // counted once per order, not twice
  });

  it("sorts co-ordered items descending and caps at top 5", () => {
    const makeOrder = (id: string, coMenuIds: string[]) =>
      mockOrder({
        id,
        orderId: `RK-0${id}`,
        items: [
          { menuId: "biryani-chicken", name: "Chicken Biryani", qty: 1, pricePerUnit: 799, lineTotal: 799 },
          ...coMenuIds.map((mid) => ({ menuId: mid, name: mid, qty: 1, pricePerUnit: 100, lineTotal: 100 })),
        ],
      });

    const otherIds = ["item-a", "item-b", "item-c", "item-d", "item-e", "item-f"];
    // item-a co-ordered 6 times, item-b 5 times, ..., item-f once
    const orders: Order[] = [];
    otherIds.forEach((id, idx) => {
      const timesCoOrdered = otherIds.length - idx;
      for (let i = 0; i < timesCoOrdered; i++) {
        orders.push(makeOrder(`${id}-${i}`, [id]));
      }
    });

    const detail = computeItemDetail(orders, "biryani-chicken");
    expect(detail!.coOrderedItems).toHaveLength(5);
    expect(detail!.coOrderedItems[0].menuId).toBe("item-a");
    expect(detail!.coOrderedItems[0].coOrderCount).toBe(6);
    // item-f (count 1) should be excluded by the top-5 cap
    expect(detail!.coOrderedItems.find((e) => e.menuId === "item-f")).toBeUndefined();
  });
});
