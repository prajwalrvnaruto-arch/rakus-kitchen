import { describe, expect, it } from "vitest";
import { aggregatePrepQuantities, formatKg, totalWeightByDish } from "@/lib/kitchenPrep";
import type { OrderLineItem } from "@/types";

// Builders that mirror the real cart → order line shapes:
//  - biryani: menuId "biryani-<meat>", variant "<w> kg · <Meat>"
//  - weight dishes: variant "½ kg" / "1 kg"
//  - extra meat: menuId "extra-<meat>-250g", no variant
//  - per-unit / per-kg dishes without size options: no variant
const item = (menuId: string, name: string, qty: number, variant?: string): OrderLineItem => ({
  menuId, name, qty, pricePerUnit: 100, lineTotal: 100 * qty, ...(variant ? { variant } : {}),
});
const chickenBiryani = (w: string, qty: number) => item("biryani-chicken", "Chicken Biryani", qty, `${w} kg · Chicken`);
const muttonBiryani = (w: string, qty: number) => item("biryani-mutton", "Mutton Biryani", qty, `${w} kg · Mutton`);
const extraChicken = (qty: number) => item("extra-chicken-250g", "Extra Chicken 250g", qty);
const extraMutton = (qty: number) => item("extra-mutton-250g", "Extra Mutton 250g", qty);
const order = (...items: OrderLineItem[]) => ({ items });

const rowFor = (rows: ReturnType<typeof aggregatePrepQuantities>, menuId: string, variant?: string) =>
  rows.find((r) => r.menuId === menuId && r.variant === variant);

describe("aggregatePrepQuantities", () => {
  it("returns no rows for no orders", () => {
    expect(aggregatePrepQuantities([])).toEqual([]);
  });

  it("returns no rows for orders with empty item lists", () => {
    expect(aggregatePrepQuantities([order(), order()])).toEqual([]);
  });

  it("merges the same dish + size across orders and sums quantities", () => {
    const rows = aggregatePrepQuantities([
      order(chickenBiryani("½", 4)),
      order(chickenBiryani("½", 6)),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].totalQty).toBe(10);
    expect(rows[0].totalWeightKg).toBe(5);
  });

  it("merges a duplicated line inside a single order", () => {
    const rows = aggregatePrepQuantities([order(extraChicken(1), extraChicken(2))]);
    expect(rows).toHaveLength(1);
    expect(rows[0].totalQty).toBe(3);
  });

  it("keeps different sizes of the same dish as separate rows", () => {
    const rows = aggregatePrepQuantities([order(chickenBiryani("½", 1), chickenBiryani("1", 1))]);
    expect(rows).toHaveLength(2);
    expect(rowFor(rows, "biryani-chicken", "½ kg · Chicken")?.totalWeightKg).toBe(0.5);
    expect(rowFor(rows, "biryani-chicken", "1 kg · Chicken")?.totalWeightKg).toBe(1);
  });

  it("parses every biryani weight tier (½, 1, 2, 3 kg)", () => {
    const rows = aggregatePrepQuantities([
      order(muttonBiryani("½", 1), muttonBiryani("1", 1), muttonBiryani("2", 1), muttonBiryani("3", 2)),
    ]);
    expect(rows.map((r) => r.totalWeightKg).sort()).toEqual([0.5, 1, 2, 6]);
  });

  it("parses plain weight sizes on non-biryani dishes (½ kg / 1 kg)", () => {
    const rows = aggregatePrepQuantities([
      order(item("andhra-chilli-chicken", "Chilly Chicken", 3, "½ kg"), item("white-rice", "White Rice", 2, "1 kg")),
    ]);
    expect(rowFor(rows, "andhra-chilli-chicken", "½ kg")?.totalWeightKg).toBe(1.5);
    expect(rowFor(rows, "white-rice", "1 kg")?.totalWeightKg).toBe(2);
  });

  it("leaves weight undefined for per-unit items", () => {
    const rows = aggregatePrepQuantities([order(item("ragi-mudde", "Ragi Mudde", 6), item("rasam", "Rasam", 2))]);
    expect(rows.every((r) => r.totalWeightKg === undefined)).toBe(true);
    expect(rowFor(rows, "ragi-mudde")?.totalQty).toBe(6);
  });

  it("counts an odd-but-valid kg size (1.5 kg × 2 = 3 kg) instead of dropping it", () => {
    const rows = aggregatePrepQuantities([order(chickenBiryani("1.5", 2))]);
    expect(rows[0].totalWeightKg).toBe(3);
    expect(rows[0].totalQty).toBe(2);
  });

  it("flags extra-meat lines as add-ons and puts them last", () => {
    const rows = aggregatePrepQuantities([
      order(extraMutton(1), item("ragi-mudde", "Ragi Mudde", 1), extraChicken(1), chickenBiryani("1", 1)),
    ]);
    expect(rows.map((r) => r.isAddon)).toEqual([false, false, true, true]);
    expect(rows.at(-1)?.menuId).toBe("extra-mutton-250g"); // add-ons sorted by name
  });

  it("orders categories: Biryani → Chicken → Mutton → Other → Add-ons, A–Z within each", () => {
    const rows = aggregatePrepQuantities([
      order(
        extraChicken(1),
        item("rasam", "Rasam", 1),
        item("mutton-chops", "Mutton Chops", 1, "½ kg"),
        item("pepper-chicken", "Chicken Pepper", 1, "½ kg"),
        item("guntur-chicken", "Guntur Chicken", 1, "½ kg"),
        muttonBiryani("1", 1),
        chickenBiryani("1", 1),
        item("fish-fry", "Fish Fry", 1),
      ),
    ]);
    expect(rows.map((r) => r.name)).toEqual([
      "Chicken Biryani", "Mutton Biryani",
      "Chicken Pepper", "Guntur Chicken",
      "Mutton Chops",
      "Fish Fry", "Rasam",
      "Extra Chicken 250g",
    ]);
  });

  it("does not mutate the input orders", () => {
    const orders = [order(chickenBiryani("½", 2)), order(chickenBiryani("½", 3))];
    const snapshot = JSON.parse(JSON.stringify(orders));
    aggregatePrepQuantities(orders);
    expect(orders).toEqual(snapshot);
  });

  // The doc comment says this function excludes cancelled orders, but it only
  // receives { items } — the /kitchen page does the Cancelled filtering. This
  // pins that contract so a caller can't assume the helper filters for them.
  it("does not filter cancelled orders itself (the page must)", () => {
    const cancelled = { status: "Cancelled", items: [chickenBiryani("1", 9)] };
    expect(aggregatePrepQuantities([cancelled])[0].totalQty).toBe(9);
  });

  // Per-kg dishes with no size option (Fish Fry, the sambars, Mutton Fry) carry
  // kg as the quantity. They count toward kg totals, one kg per unit of qty.
  it("counts a per-kg dish without a size option as kg (Fish Fry × 2 = 2 kg)", () => {
    const rows = aggregatePrepQuantities([order(item("fish-fry", "Fish Fry", 2))]);
    expect(rows[0].totalWeightKg).toBe(2);
  });

  // Guntur Mutton is a Mutton Speciality in the menu, so it sorts with the other
  // mutton dishes (and before Other Items like Fish Fry), read from MENU not guessed.
  it("sorts Guntur Mutton with the mutton dishes, before Other Items", () => {
    const rows = aggregatePrepQuantities([
      order(item("fish-fry", "Fish Fry", 1), item("guntur-mutton", "Guntur Mutton", 1, "1 kg")),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Guntur Mutton", "Fish Fry"]);
  });

  // The quantity label for a no-variant per-unit dish uses the menu's own unit
  // ("per pcs" → "pcs"), not a bare "unit".
  it("labels per-unit dishes with their menu unit (Ragi Mudde → pcs)", () => {
    const rows = aggregatePrepQuantities([order(item("ragi-mudde", "Ragi Mudde", 4))]);
    expect(rowFor(rows, "ragi-mudde")?.unit).toBe("pcs");
  });
});

describe("totalWeightByDish", () => {
  const totals = (...orders: Array<{ items: OrderLineItem[] }>) =>
    totalWeightByDish(aggregatePrepQuantities(orders));

  it("adds all sizes of a dish together (½ kg × 10 + 1 kg × 5 = 10 kg)", () => {
    const t = totals(order(chickenBiryani("½", 10)), order(chickenBiryani("1", 5)));
    expect(t).toEqual([{ key: "biryani-chicken", name: "Chicken Biryani", kg: 10 }]);
  });

  it("keeps each dish as its own total", () => {
    const t = totals(order(chickenBiryani("½", 2), muttonBiryani("2", 1), muttonBiryani("3", 1)));
    expect(t.map((x) => [x.name, x.kg])).toEqual([["Chicken Biryani", 1], ["Mutton Biryani", 5]]);
  });

  it("counts extra meat at 250 g each, as its own line per meat", () => {
    const t = totals(order(extraChicken(3)), order(extraMutton(2)));
    expect(t.map((x) => [x.name, x.kg])).toEqual([["Extra Chicken", 0.75], ["Extra Mutton", 0.5]]);
  });

  it("does not fold extra meat into the biryani total", () => {
    const t = totals(order(chickenBiryani("1", 2), extraChicken(2)));
    expect(t.find((x) => x.name === "Chicken Biryani")?.kg).toBe(2);
    expect(t.find((x) => x.name === "Extra Chicken")?.kg).toBe(0.5);
  });

  it("works out the gram size from the add-on id (500 g counts as 0.5 kg)", () => {
    const t = totals(order(extraChicken(1), item("extra-chicken-500g", "Extra Chicken 500g", 1)));
    expect(t).toEqual([{ key: "extra-chicken", name: "Extra Chicken", kg: 0.75 }]);
  });

  it("leaves out per-unit items (Ragi Mudde, Rasam, Nati Koli Saru)", () => {
    const t = totals(order(item("ragi-mudde", "Ragi Mudde", 8), item("rasam", "Rasam", 2), item("nati-koli-saru", "Nati Koli Saru", 1)));
    expect(t).toEqual([]);
  });

  it("leaves out an add-on that isn't extra meat", () => {
    expect(totals(order(item("extra-raita", "Extra Raita", 3)))).toEqual([]);
  });

  it("returns nothing for an empty slot", () => {
    expect(totalWeightByDish([])).toEqual([]);
  });

  it("follows the prep-sheet order: biryani first, dishes next, extra meat last", () => {
    const t = totals(order(extraMutton(1), item("mutton-chops", "Mutton Chops", 1, "½ kg"), chickenBiryani("1", 1)));
    expect(t.map((x) => x.name)).toEqual(["Chicken Biryani", "Mutton Chops", "Extra Mutton"]);
  });

  it("handles a large slot without drift (200 × ½ kg = 100 kg)", () => {
    const orders = Array.from({ length: 200 }, () => order(chickenBiryani("½", 1)));
    expect(totals(...orders)[0].kg).toBe(100);
  });
});

describe("formatKg", () => {
  it.each([
    [10, "10 kg"],
    [2.5, "2.5 kg"],
    [0.75, "0.75 kg"],
    [0, "0 kg"],
    [0.1 + 0.2, "0.3 kg"], // float noise is hidden
    [1 / 3, "0.33 kg"], // rounds to 2 decimals
    [12.25, "12.25 kg"],
  ])("formats %s as %s", (kg, expected) => {
    expect(formatKg(kg)).toBe(expected);
  });
});
