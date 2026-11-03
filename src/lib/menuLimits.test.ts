import { describe, expect, it } from "vitest";
import {
  DEFAULT_ITEM_LIMIT,
  canAddToCart,
  cartAggregateQty,
  deriveAvailability,
  itemHasQuantityLimit,
  maxAddableQty,
  quantityInLimitUnits,
} from "./menuLimits";
import { menuItemById } from "./menu";
import type { CartItem } from "@/types";

describe("itemHasQuantityLimit", () => {
  it("is true for non-veg items (chicken/mutton/fish)", () => {
    expect(itemHasQuantityLimit(menuItemById("fish-fry")!)).toBe(true);
    expect(itemHasQuantityLimit(menuItemById("andhra-chilli-chicken")!)).toBe(true);
    expect(itemHasQuantityLimit(menuItemById("mutton-sukka")!)).toBe(true);
    expect(itemHasQuantityLimit(menuItemById("nati-koli-saru")!)).toBe(true);
  });

  it("is false for veg items", () => {
    expect(itemHasQuantityLimit(menuItemById("rasam")!)).toBe(false);
    expect(itemHasQuantityLimit(menuItemById("ragi-mudde")!)).toBe(false);
    expect(itemHasQuantityLimit(menuItemById("white-rice")!)).toBe(false);
    expect(itemHasQuantityLimit(menuItemById("raita")!)).toBe(false);
  });
});

describe("quantityInLimitUnits", () => {
  it("converts biryani lines to kg via the weight in the variant label", () => {
    expect(quantityInLimitUnits("biryani-chicken", "1 kg · Chicken", 3)).toBe(3);
    expect(quantityInLimitUnits("biryani-mutton", "½ kg · Mutton", 2)).toBe(1);
    expect(quantityInLimitUnits("biryani-chicken", "2 kg · Chicken", 1)).toBe(2);
  });

  it("converts weight-variant specialities (chicken/mutton) to kg", () => {
    expect(quantityInLimitUnits("andhra-chilli-chicken", "1 kg", 2)).toBe(2);
    expect(quantityInLimitUnits("mutton-chops", "½ kg", 4)).toBe(2);
  });

  it("treats flat per-kg items as 1 limit unit per qty", () => {
    expect(quantityInLimitUnits("fish-fry", undefined, 5)).toBe(5);
    expect(quantityInLimitUnits("chicken-sambar", undefined, 3)).toBe(3);
    expect(quantityInLimitUnits("mutton-sukka", undefined, 2)).toBe(2);
  });

  it("treats per-full (whole bird) items as a plain count, not kg", () => {
    expect(quantityInLimitUnits("nati-koli-saru", undefined, 4)).toBe(4);
  });

  it("excludes extra-meat add-on lines entirely", () => {
    expect(quantityInLimitUnits("extra-chicken-250g", undefined, 10)).toBe(0);
    expect(quantityInLimitUnits("extra-mutton-250g", undefined, 10)).toBe(0);
  });
});

describe("deriveAvailability", () => {
  it("is available below the limit with no override", () => {
    expect(
      deriveAvailability({ orderedQty: 5, limit: DEFAULT_ITEM_LIMIT, manualOverride: null }),
    ).toBe("available");
  });

  it("is unavailable at or above the limit with no override", () => {
    expect(
      deriveAvailability({ orderedQty: 10, limit: DEFAULT_ITEM_LIMIT, manualOverride: null }),
    ).toBe("unavailable");
    expect(
      deriveAvailability({ orderedQty: 12, limit: DEFAULT_ITEM_LIMIT, manualOverride: null }),
    ).toBe("unavailable");
  });

  it("a manual override always wins over the computed state", () => {
    expect(
      deriveAvailability({ orderedQty: 0, limit: DEFAULT_ITEM_LIMIT, manualOverride: "unavailable" }),
    ).toBe("unavailable");
    expect(
      deriveAvailability({ orderedQty: 999, limit: DEFAULT_ITEM_LIMIT, manualOverride: "available" }),
    ).toBe("available");
  });
});

function line(menuId: string, quantity: number, variant?: string): CartItem {
  return { menuId, name: menuId, emoji: "🍗", price: 0, quantity, variant };
}

describe("cartAggregateQty", () => {
  it("sums quantity across variants of the same menuId, in limit units", () => {
    const cart = [
      line("biryani-chicken", 2, "1 kg · Chicken"),
      line("biryani-chicken", 1, "½ kg · Chicken"),
      line("biryani-mutton", 1, "1 kg · Mutton"),
    ];
    expect(cartAggregateQty("biryani-chicken", cart)).toBe(2.5); // 1×2 + 0.5×1
    expect(cartAggregateQty("biryani-mutton", cart)).toBe(1);
  });

  it("ignores add-on (extra-meat) lines", () => {
    const cart = [line("extra-chicken-250g", 10)];
    expect(cartAggregateQty("extra-chicken-250g", cart)).toBe(0);
  });

  it("returns 0 when the item isn't in the cart", () => {
    expect(cartAggregateQty("biryani-chicken", [])).toBe(0);
  });
});

describe("canAddToCart", () => {
  const chickenBiryani = menuItemById("biryani-chicken")!;
  const rasam = menuItemById("rasam")!;

  it("allows adding when remaining inventory covers the request", () => {
    const result = canAddToCart({
      item: chickenBiryani,
      cfg: { orderedQty: 2, limit: 10, manualOverride: null },
      cartItems: [],
      requestedVariant: "1 kg · Chicken",
      requestedQty: 1,
    });
    expect(result.canAdd).toBe(true);
  });

  it("blocks adding when cart + requested would exceed remaining", () => {
    // remaining = 10 - 4 = 6kg. Cart already has 5kg. Requesting 2 more (7kg) exceeds it.
    const cart = [line("biryani-chicken", 5, "1 kg · Chicken")];
    const result = canAddToCart({
      item: chickenBiryani,
      cfg: { orderedQty: 4, limit: 10, manualOverride: null },
      cartItems: cart,
      requestedVariant: "1 kg · Chicken",
      requestedQty: 2,
    });
    expect(result.canAdd).toBe(false);
    if (!result.canAdd) expect(result.reason).toContain("left");
  });

  it("allows adding exactly up to the remaining amount", () => {
    // remaining = 10 - 8 = 2kg. Cart has 1kg. Requesting 1 more (2kg total) fits exactly.
    const cart = [line("biryani-chicken", 1, "1 kg · Chicken")];
    const result = canAddToCart({
      item: chickenBiryani,
      cfg: { orderedQty: 8, limit: 10, manualOverride: null },
      cartItems: cart,
      requestedVariant: "1 kg · Chicken",
      requestedQty: 1,
    });
    expect(result.canAdd).toBe(true);
  });

  it("respects manual override: available allows any amount", () => {
    const result = canAddToCart({
      item: chickenBiryani,
      cfg: { orderedQty: 10, limit: 10, manualOverride: "available" },
      cartItems: [],
      requestedVariant: "1 kg · Chicken",
      requestedQty: 100,
    });
    expect(result.canAdd).toBe(true);
  });

  it("respects manual override: unavailable blocks everything", () => {
    const result = canAddToCart({
      item: chickenBiryani,
      cfg: { orderedQty: 0, limit: 10, manualOverride: "unavailable" },
      cartItems: [],
      requestedVariant: "1 kg · Chicken",
      requestedQty: 1,
    });
    expect(result.canAdd).toBe(false);
    if (!result.canAdd) expect(result.reason).toContain("unavailable");
  });

  it("allows veg items regardless of cart or ordered quantity", () => {
    const result = canAddToCart({
      item: rasam,
      cfg: { orderedQty: 1000, limit: 10, manualOverride: null },
      cartItems: [],
      requestedVariant: undefined,
      requestedQty: 999,
    });
    expect(result.canAdd).toBe(true);
  });
});

describe("maxAddableQty", () => {
  const chickenBiryani = menuItemById("biryani-chicken")!;
  const rasam = menuItemById("rasam")!;
  const fishFry = menuItemById("fish-fry")!;

  it("converts remaining kg headroom into a stepper-unit ceiling", () => {
    // remaining = 10 - 0 = 10kg, empty cart, 1kg variant → 10 parcels.
    expect(
      maxAddableQty({
        item: chickenBiryani,
        cfg: { orderedQty: 0, limit: 10, manualOverride: null },
        cartItems: [],
        requestedVariant: "1 kg · Chicken",
      }),
    ).toBe(10);
  });

  it("floors a fractional ceiling rather than overshooting it", () => {
    // remaining = 10 - 8 = 2kg, ½kg variant → floor(2 / 0.5) = 4 parcels.
    expect(
      maxAddableQty({
        item: chickenBiryani,
        cfg: { orderedQty: 8, limit: 10, manualOverride: null },
        cartItems: [],
        requestedVariant: "½ kg · Chicken",
      }),
    ).toBe(4);
  });

  it("subtracts what the cart already holds before converting to stepper units", () => {
    // remaining = 10 - 4 = 6kg. Cart already has 5kg (5×1kg). canStillAdd = 1kg → 1 parcel at 1kg.
    const cart = [line("biryani-chicken", 5, "1 kg · Chicken")];
    expect(
      maxAddableQty({
        item: chickenBiryani,
        cfg: { orderedQty: 4, limit: 10, manualOverride: null },
        cartItems: cart,
        requestedVariant: "1 kg · Chicken",
      }),
    ).toBe(1);
  });

  it("is 0 once the cart already holds everything that's left — not negative, not able to trap a decrement", () => {
    const cart = [line("biryani-chicken", 10, "1 kg · Chicken")];
    expect(
      maxAddableQty({
        item: chickenBiryani,
        cfg: { orderedQty: 0, limit: 10, manualOverride: null },
        cartItems: cart,
        requestedVariant: "1 kg · Chicken",
      }),
    ).toBe(0);
  });

  it("is 0 under a manual 'unavailable' override", () => {
    expect(
      maxAddableQty({
        item: chickenBiryani,
        cfg: { orderedQty: 0, limit: 10, manualOverride: "unavailable" },
        cartItems: [],
        requestedVariant: "1 kg · Chicken",
      }),
    ).toBe(0);
  });

  it("is unlimited (Infinity) under a manual 'available' override", () => {
    expect(
      maxAddableQty({
        item: chickenBiryani,
        cfg: { orderedQty: 10, limit: 10, manualOverride: "available" },
        cartItems: [],
        requestedVariant: "1 kg · Chicken",
      }),
    ).toBe(Infinity);
  });

  it("is unlimited (Infinity) for veg items regardless of ordered/cart quantity", () => {
    expect(
      maxAddableQty({
        item: rasam,
        cfg: { orderedQty: 1000, limit: 10, manualOverride: null },
        cartItems: [],
        requestedVariant: undefined,
      }),
    ).toBe(Infinity);
  });

  it("treats a flat per-kg item's stepper unit as 1kg each", () => {
    // remaining = 10 - 7 = 3kg, no variant (per-kg item) → 3 units.
    expect(
      maxAddableQty({
        item: fishFry,
        cfg: { orderedQty: 7, limit: 10, manualOverride: null },
        cartItems: [],
        requestedVariant: undefined,
      }),
    ).toBe(3);
  });
});
