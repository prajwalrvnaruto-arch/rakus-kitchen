import { describe, it, expect } from "vitest";
import {
  BIRYANI_PRICING,
  EXTRA_MEAT_PRICE,
  PACKAGING_FEE_PER_UNIT,
  allowedExtraMeatUnits,
  parseBiryaniWeight,
  reconcileExtraMeatLines,
  recomputeOrderTotals,
  resolveUnitPrice,
} from "./menu";
import type { CartItem } from "@/types";

// Small helper for building extra-meat cart lines in the reconcile tests.
const addon = (menuId: string, quantity: number, variant?: string): CartItem => ({
  menuId,
  name: menuId,
  emoji: "🍗",
  price: 0,
  quantity,
  variant,
  isAddon: true,
});
const line = (menuId: string, quantity: number, variant?: string): CartItem => ({
  menuId,
  name: menuId,
  emoji: "🍗",
  price: 0,
  quantity,
  variant,
});

describe("parseBiryaniWeight", () => {
  it("parses canonical labels", () => {
    expect(parseBiryaniWeight("½ kg · Chicken")).toBe(0.5);
    expect(parseBiryaniWeight("1 kg · Mutton")).toBe(1);
    expect(parseBiryaniWeight("2 kg · Chicken")).toBe(2);
    expect(parseBiryaniWeight("3 kg · Mutton")).toBe(3);
  });

  it("tolerates spacing and glyph/decimal variations", () => {
    expect(parseBiryaniWeight("½kg·Chicken")).toBe(0.5);
    expect(parseBiryaniWeight("0.5 kg · Chicken")).toBe(0.5);
    expect(parseBiryaniWeight("  1 kg  ·  Chicken ")).toBe(1);
  });

  it("returns null for unparseable or out-of-range weights", () => {
    expect(parseBiryaniWeight(undefined)).toBeNull();
    expect(parseBiryaniWeight("")).toBeNull();
    expect(parseBiryaniWeight("5 kg · Chicken")).toBeNull();
    expect(parseBiryaniWeight("Large · Chicken")).toBeNull();
  });
});

describe("resolveUnitPrice", () => {
  it("resolves biryani prices from the pricing table", () => {
    expect(resolveUnitPrice("biryani-chicken", "1 kg · Chicken")).toEqual({
      pricePerUnit: BIRYANI_PRICING[1].chicken,
      name: "Chicken Biryani",
    });
    expect(resolveUnitPrice("biryani-mutton", "½ kg · Mutton")?.pricePerUnit).toBe(
      BIRYANI_PRICING[0.5].mutton,
    );
  });

  it("resolves extra-meat add-ons", () => {
    expect(resolveUnitPrice("extra-chicken-250g")?.pricePerUnit).toBe(EXTRA_MEAT_PRICE.chicken);
    expect(resolveUnitPrice("extra-mutton-250g")?.pricePerUnit).toBe(EXTRA_MEAT_PRICE.mutton);
    // Wrong gram amount is not a known add-on.
    expect(resolveUnitPrice("extra-chicken-500g")).toBeNull();
  });

  it("resolves variant-priced and flat-priced daily items", () => {
    expect(resolveUnitPrice("andhra-chilli-chicken", "1 kg")?.pricePerUnit).toBe(800);
    expect(resolveUnitPrice("fish-fry")?.pricePerUnit).toBe(800);
  });

  it("rejects unknown ids, missing variants, and zero-priced sentinels", () => {
    expect(resolveUnitPrice("nope")).toBeNull();
    expect(resolveUnitPrice("biryani-chicken", "bad label")).toBeNull();
    expect(resolveUnitPrice("andhra-chilli-chicken", "3 kg")).toBeNull();
    // Biryani base item carries price:0 as a sentinel — not orderable flat.
    expect(resolveUnitPrice("biryani-chicken")).toBeNull();
  });
});

describe("allowedExtraMeatUnits — pooled cap", () => {
  it("pools the per-tier cap across all biryani lines of a meat", () => {
    // Two ½kg chicken (cap 1 each) → pooled 2; one 1kg chicken (cap 2) → +2 = 4.
    const allowed = allowedExtraMeatUnits([
      { menuId: "biryani-chicken", variant: "½ kg · Chicken", qty: 2 },
      { menuId: "biryani-chicken", variant: "1 kg · Chicken", qty: 1 },
      { menuId: "biryani-mutton", variant: "1 kg · Mutton", qty: 1 },
    ]);
    expect(allowed.chicken).toBe(2 * 1 + 1 * 2);
    expect(allowed.mutton).toBe(1 * 2);
  });

  it("is zero when there are no biryani lines", () => {
    expect(allowedExtraMeatUnits([{ menuId: "fish-fry", qty: 3 }])).toEqual({ chicken: 0, mutton: 0 });
  });
});

describe("reconcileExtraMeatLines", () => {
  it("keeps add-ons within the pooled budget", () => {
    const items = [line("biryani-chicken", 1, "1 kg · Chicken"), addon("extra-chicken-250g", 2)];
    expect(reconcileExtraMeatLines(items)).toHaveLength(2);
  });

  it("clamps an add-on that exceeds the budget", () => {
    const items = [line("biryani-chicken", 1, "½ kg · Chicken"), addon("extra-chicken-250g", 5)];
    const out = reconcileExtraMeatLines(items);
    const meatLine = out.find((i) => i.menuId === "extra-chicken-250g");
    expect(meatLine?.quantity).toBe(1); // ½kg tier caps at 1
  });

  it("drops an orphaned add-on when its biryani is gone", () => {
    const items = [line("fish-fry", 1), addon("extra-mutton-250g", 2)];
    const out = reconcileExtraMeatLines(items);
    expect(out.find((i) => i.menuId === "extra-mutton-250g")).toBeUndefined();
  });
});

describe("recomputeOrderTotals", () => {
  it("computes item total, packaging fee, and grand total", () => {
    const result = recomputeOrderTotals([
      { menuId: "biryani-chicken", variant: "1 kg · Chicken", qty: 2 },
      { menuId: "fish-fry", qty: 1 },
    ]);
    if ("error" in result) throw new Error(result.error);
    const expectedItems = BIRYANI_PRICING[1].chicken * 2 + 800;
    expect(result.itemTotal).toBe(expectedItems);
    expect(result.packagingFee).toBe(3 * PACKAGING_FEE_PER_UNIT); // 3 units
    expect(result.grandTotal).toBe(expectedItems + 3 * PACKAGING_FEE_PER_UNIT);
  });

  it("errors on an empty cart", () => {
    expect(recomputeOrderTotals([])).toEqual({ error: "Cart is empty" });
  });

  it("errors on a non-positive or non-integer quantity", () => {
    expect(recomputeOrderTotals([{ menuId: "fish-fry", qty: 0 }])).toHaveProperty("error");
    expect(recomputeOrderTotals([{ menuId: "fish-fry", qty: 1.5 }])).toHaveProperty("error");
  });

  it("errors on an unverifiable line", () => {
    const r = recomputeOrderTotals([{ menuId: "made-up", qty: 1 }]);
    expect("error" in r && r.error).toMatch(/verify price/i);
  });

  it("errors when extra meat exceeds the pooled cap", () => {
    const r = recomputeOrderTotals([
      { menuId: "biryani-chicken", variant: "½ kg · Chicken", qty: 1 }, // cap 1
      { menuId: "extra-chicken-250g", qty: 3 },
    ]);
    expect("error" in r && r.error).toMatch(/too much extra chicken/i);
  });

  it("allows extra meat exactly at the pooled cap", () => {
    const r = recomputeOrderTotals([
      { menuId: "biryani-chicken", variant: "1 kg · Chicken", qty: 1 }, // cap 2
      { menuId: "extra-chicken-250g", qty: 2 },
    ]);
    expect("error" in r).toBe(false);
  });
});
