import type { CartItem, MenuItem } from "@/types";
import { extraMeatMeatFromMenuId, menuItemById, parseBiryaniWeight } from "./menu";

/**
 * ── ITEM QUANTITY LIMITS — pure, dependency-free logic ───────────────────
 * Mirrors the rate-limit-policy.ts pattern: no Firestore, no server-only
 * imports, fully unit-testable. The actual enforcement (reading/writing
 * Firestore) lives in src/lib/server/menuConfig.ts, which wraps these
 * functions in a transaction.
 */

/** Default per-item quantity limit, in that item's own limit unit — kilograms
 *  for weight-sold dishes, whole units for count-sold ones (e.g. whole birds).
 *  Admin-editable per item from the inventory page. */
export const DEFAULT_ITEM_LIMIT = 10;

/**
 * Only chicken/mutton/fish (non-veg) items carry a quantity limit and
 * availability gate — confirmed by the business. Veg items (rasam, ragi
 * mudde, white rice, raita) are unlimited, though their sales are still
 * tracked for the admin's order-quantity dashboard.
 */
export function itemHasQuantityLimit(item: MenuItem): boolean {
  return !item.veg;
}

/**
 * Converts an order line's (menuId, variant, qty) into the unit its limit is
 * tracked in:
 *  - Biryani (biryani-chicken/biryani-mutton) and weight-variant dishes
 *    (Chicken/Mutton Specialities' ½kg/1kg pills) → kilograms, via the same
 *    parseBiryaniWeight() parser menu.ts already uses for pricing.
 *  - Flat-priced items ("per kg", "per full", "per ltr", "per pcs") → each
 *    ordered unit counts as exactly 1 limit unit (1 kg, or 1 whole bird for
 *    nati-koli-saru).
 *  - Extra-meat add-on lines (extra-chicken-250g / extra-mutton-250g) → 0,
 *    excluded entirely. They're already pool-capped against their parent
 *    biryani via EXTRA_MEAT_MAX_UNITS and were never meant to consume the
 *    dish's own limit.
 */
export function quantityInLimitUnits(
  menuId: string,
  variant: string | undefined,
  qty: number,
): number {
  if (extraMeatMeatFromMenuId(menuId) !== null) return 0;

  const isBiryani = /^biryani-(chicken|mutton)$/.test(menuId);
  const item = menuItemById(menuId);
  const isWeightVariant = !isBiryani && !!item?.variants;

  if (isBiryani || isWeightVariant) {
    const weight = parseBiryaniWeight(variant);
    // Shouldn't happen in practice — recomputeOrderTotals() already rejects an
    // unparseable variant (as an unverifiable price) before quantity limits
    // are ever checked — but fall back to 1kg/unit rather than undercounting.
    return (weight ?? 1) * qty;
  }

  return qty;
}

/** Human-friendly unit label for quantity-limit messaging — "kg" for
 *  weight-tracked items, "unit(s)" for count-tracked ones (e.g. whole birds). */
export function limitUnitLabel(item: MenuItem): string {
  return item.unit === "per full" ? "unit(s)" : "kg";
}

export type ManualOverride = "available" | "unavailable" | null;

/** Shape of a menuConfig/{menuId} Firestore doc — the single per-item record
 *  shared by server-side tracking (server/menuConfig.ts) and the client
 *  availability context/admin inventory page. */
export interface MenuItemConfig {
  limitEnabled: boolean;
  limit: number;
  orderedQty: number;
  manualOverride: ManualOverride;
  updatedAt: number;
}

export type AvailabilityInput = Pick<MenuItemConfig, "orderedQty" | "limit" | "manualOverride">;

/**
 * Derives the effective availability for a menu item. An explicit admin
 * override always wins; otherwise it's automatic once orderedQty reaches
 * the configured limit.
 */
export function deriveAvailability(cfg: AvailabilityInput): "available" | "unavailable" {
  if (cfg.manualOverride) return cfg.manualOverride;
  return cfg.orderedQty >= cfg.limit ? "unavailable" : "available";
}

/**
 * Sums how much of one menu item is already sitting in the cart, across all
 * of its variants (e.g. a ½kg line and a 1kg line of the same biryani both
 * count), in that item's own limit unit. This is the cart-side half of the
 * "10kg total, however it's split across add-to-cart taps" enforcement —
 * quantityInLimitUnits() already returns 0 for add-on lines, so those are
 * excluded automatically.
 */
export function cartAggregateQty(menuId: string, cartItems: CartItem[]): number {
  return cartItems
    .filter((line) => line.menuId === menuId)
    .reduce((sum, line) => sum + quantityInLimitUnits(line.menuId, line.variant, line.quantity), 0);
}

/**
 * Cart-level gate, checked before an Add button or a cart "+" is allowed to
 * fire. deriveAvailability()/checkQuantityLimits() only stop a customer once
 * the *global* orderedQty has caught up with the limit — they say nothing
 * about a customer who keeps adding/incrementing a still-"available" item in
 * their own cart past what's actually left. This closes that gap: it adds
 * what's already in the cart to what's being requested now, and compares
 * against remaining = limit - orderedQty.
 *
 * Client-side UX only — src/lib/server/menuConfig.ts's checkQuantityLimits()
 * is still the authoritative, server-side gate at order time.
 */
export function canAddToCart(opts: {
  item: MenuItem;
  cfg: AvailabilityInput;
  cartItems: CartItem[];
  requestedVariant: string | undefined;
  requestedQty: number;
}): { canAdd: true } | { canAdd: false; reason: string } {
  const { item, cfg, cartItems, requestedVariant, requestedQty } = opts;

  // Veg items carry no limit at all.
  if (!itemHasQuantityLimit(item)) return { canAdd: true };

  // A manual override always wins, same as deriveAvailability().
  if (cfg.manualOverride === "unavailable") {
    return { canAdd: false, reason: `${item.name} is currently unavailable.` };
  }
  if (cfg.manualOverride === "available") return { canAdd: true };

  const remaining = Math.max(0, cfg.limit - cfg.orderedQty);
  const cartAlreadyHas = cartAggregateQty(item.id, cartItems);
  const canStillAdd = Math.max(0, remaining - cartAlreadyHas);
  const requestedAdditional = quantityInLimitUnits(item.id, requestedVariant, requestedQty);

  if (requestedAdditional > canStillAdd) {
    const unit = limitUnitLabel(item);
    return {
      canAdd: false,
      reason: canStillAdd > 0
        ? `Only ${canStillAdd}${unit} of ${item.name} left — your cart already has ${cartAlreadyHas}${unit}.`
        : `${item.name} is fully in your cart already — no more left today.`,
    };
  }

  return { canAdd: true };
}

/**
 * The highest stepper qty (parcels/portions — the same unit the +/- buttons
 * count in, not kg) that still passes canAddToCart() for the given variant.
 *
 * This is the proactive counterpart to canAddToCart(): instead of reactively
 * flagging "this qty is too high" (which, fed into a stepper's disabled prop,
 * blocks decrement too — the exact trap this function exists to avoid), it
 * gives the stepper a ceiling so "+" simply stops at the right place and "−"
 * is never touched by the cart-limit check at all.
 *
 * Returns Infinity when there's no limit to cap against (veg items, or a
 * manual "available" override) — callers should Math.min() this with
 * whatever ordinary max the stepper already uses (e.g. 20).
 */
export function maxAddableQty(opts: {
  item: MenuItem;
  cfg: AvailabilityInput;
  cartItems: CartItem[];
  requestedVariant: string | undefined;
}): number {
  const { item, cfg, cartItems, requestedVariant } = opts;

  if (!itemHasQuantityLimit(item)) return Infinity;
  if (cfg.manualOverride === "unavailable") return 0;
  if (cfg.manualOverride === "available") return Infinity;

  const remaining = Math.max(0, cfg.limit - cfg.orderedQty);
  const cartAlreadyHas = cartAggregateQty(item.id, cartItems);
  const canStillAdd = Math.max(0, remaining - cartAlreadyHas);

  // Per-unit weight of the variant being configured — e.g. 0.5 for "½ kg".
  // A per-count item (no variant/weight) has a per-unit weight of 1.
  const perUnit = quantityInLimitUnits(item.id, requestedVariant, 1);
  if (perUnit <= 0) return Infinity; // shouldn't happen, but never divide by 0

  return Math.floor(canStillAdd / perUnit);
}
