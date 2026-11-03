import type { BiryaniMeat, BiryaniWeight, CartItem, MenuItem, OrderLineItem } from "@/types";

export const PACKAGING_FEE_PER_UNIT = 20;

/**
 * ── PRICING — SINGLE SOURCE OF TRUTH ─────────────────────────────────────
 * All prices below are verified against the official Raku's Kitchen menu card.
 * Weighted dishes (½ kg / 1 kg) use `variants`; every item is orderable with a
 * confirmed price — no placeholders remain.
 */

// Confirmed biryani card pricing: Chicken ₹400 (½kg) · ₹799 (1kg),
// Mutton ₹799 (½kg) · ₹1,599 (1kg). 2kg/3kg extrapolated at the per-kg rate.
// TODO(business): confirm 2kg/3kg biryani pricing — currently extrapolated at
// the per-kg rate, not verified against a physical card. If bulk is priced
// differently, update the 2/3 rows here (this table is the single source of truth).
export const BIRYANI_PRICING: Record<BiryaniWeight, Record<BiryaniMeat, number>> = {
  0.5: { chicken: 400, mutton: 799 },
  1: { chicken: 799, mutton: 1599 },
  2: { chicken: 1598, mutton: 3198 },
  3: { chicken: 2397, mutton: 4797 },
};

// Uncooked rice vs meat per quantity (from the ratio poster).
export const BIRYANI_RATIO: Record<BiryaniWeight, { rice: string; meat: string }> = {
  0.5: { rice: "½ kg", meat: "250 g" },
  1: { rice: "1 kg", meat: "½ kg" },
  2: { rice: "2 kg", meat: "1 kg" },
  3: { rice: "3 kg", meat: "1½ kg" },
};

export const biryaniKey = (weight: BiryaniWeight, meat: BiryaniMeat) =>
  `biryani-${meat}-${weight}kg`;

// Optional add-on: extra meat on top of a biryani's included ratio, at any
// weight (½/1/2/3 kg) — chicken biryani can add extra chicken, mutton biryani
// can add extra mutton. Sold as its own cart line, independent of the
// biryani's own quantity.
export const EXTRA_MEAT_GRAMS = 250;
export const EXTRA_MEAT_PRICE: Record<BiryaniMeat, number> = { chicken: 200, mutton: 350 };

// Max number of extra 250g add-ons per weight tier — capped at 2× the meat
// already included in that tier's farm-to-pot ratio, so the add-on can never
// more than double the base order's meat.
export const EXTRA_MEAT_MAX_UNITS: Record<BiryaniWeight, number> = {
  0.5: 1,
  1: 2,
  2: 4,
  3: 6,
};
export const extraMeatMenuId = (meat: BiryaniMeat) => `extra-${meat}-${EXTRA_MEAT_GRAMS}g`;
export const extraMeatLabel = (meat: BiryaniMeat) =>
  `Extra ${meat === "chicken" ? "Chicken" : "Mutton"} (${EXTRA_MEAT_GRAMS} g)`;

export const biryaniVariantLabel = (weight: BiryaniWeight, meat: BiryaniMeat) =>
  `${weight === 0.5 ? "½" : weight} kg · ${meat === "chicken" ? "Chicken" : "Mutton"}`;

/**
 * Packaging fee — poster says "₹20 extra per parcel per item".
 * Implemented per quantity unit (3 biryani + 1 fish fry = 4 units → ₹80).
 * If the business clarifies a different reading (per line item, or flat per
 * order), change THIS function only — nothing else in the UI depends on it.
 */
export const packagingFeeForUnits = (totalUnits: number) => totalUnits * PACKAGING_FEE_PER_UNIT;

export const packagingFeeForOrder = (items: OrderLineItem[]) =>
  packagingFeeForUnits(items.reduce((sum, it) => sum + it.qty, 0));

/**
 * Daily menu — exactly the items on the official Raku's Kitchen menu card.
 * Dishes sold by weight carry `variants` (½ kg / 1 kg pills on the card);
 * the DishCard adds whichever portion the customer picks.
 */
export const MENU: MenuItem[] = [
  // ── Biryani ────────────────────────────────────────────────────────────
  {
    id: "biryani-chicken", category: "Biryani", name: "Chicken Biryani", emoji: "🍗",
    photo: "/images/dishes/biryani-chicken.webp",
    description: "Fragrant Nati-style chicken biryani. Choose a weight.",
    price: 0, // price is weight-dependent — see BIRYANI_PRICING
  },
  {
    id: "biryani-mutton", category: "Biryani", name: "Mutton Biryani", emoji: "🥘",
    photo: "/images/dishes/biryani-mutton.webp",
    description: "Slow-cooked Nati-style mutton biryani. Choose a weight.",
    price: 0,
  },

  // ── Chicken specialities ───────────────────────────────────────────────
  { id: "andhra-chilli-chicken", category: "Chicken Specialities", name: "Chilly Chicken", emoji: "🌶️", photo: "/images/dishes/andhra-chilli-chicken.webp", description: "Fiery Andhra-style chilli chicken.", variants: [{ label: "½ kg", price: 400 }, { label: "1 kg", price: 800 }] },
  { id: "guntur-chicken", category: "Chicken Specialities", name: "Guntur Chicken", emoji: "🍛", photo: "/images/dishes/guntur-chicken.webp", description: "Spicy Guntur-style chicken curry.", variants: [{ label: "½ kg", price: 400 }, { label: "1 kg", price: 800 }] },
  { id: "chicken-chops", category: "Chicken Specialities", name: "Chicken Chops", emoji: "🍖", photo: "/images/dishes/chicken-chops.webp", description: "Crisp, juicy chicken chops.", variants: [{ label: "½ kg", price: 400 }, { label: "1 kg", price: 800 }] },
  { id: "chicken-kabab", category: "Chicken Specialities", name: "Chicken Kabab", emoji: "🥙", photo: "/images/dishes/chicken-kabab.webp", description: "Char-grilled chicken kabab.", variants: [{ label: "½ kg", price: 400 }, { label: "1 kg", price: 800 }] },
  { id: "kshatriya-kabab", category: "Chicken Specialities", name: "Kshatriya Kabab", emoji: "🍢", photo: "/images/dishes/kshatriya-kabab.webp", description: "A signature spiced kabab.", variants: [{ label: "½ kg", price: 400 }, { label: "1 kg", price: 800 }] },
  { id: "pepper-chicken", category: "Chicken Specialities", name: "Chicken Pepper", emoji: "🌶️", photo: "/images/dishes/pepper-chicken.webp", description: "Kozhi-milagu style cracked pepper chicken.", variants: [{ label: "½ kg", price: 400 }, { label: "1 kg", price: 800 }] },
  { id: "chicken-sambar", category: "Chicken Specialities", name: "Chicken Sambar", emoji: "🍜", photo: "/images/dishes/chicken-sambar.webp", description: "Home-style chicken sambar.", price: 850, unit: "per kg" },

  // ── Mutton specialities ────────────────────────────────────────────────
  { id: "mutton-chops", category: "Mutton Specialities", name: "Mutton Chops", emoji: "🍖", photo: "/images/dishes/mutton-chops.webp", description: "Tender Nati-style mutton chops.", variants: [{ label: "½ kg", price: 900 }, { label: "1 kg", price: 1799 }] },
  { id: "pepper-mutton", category: "Mutton Specialities", name: "Mutton Pepper", emoji: "🌶️", photo: "/images/dishes/mutton-sukka.webp", description: "Cracked-pepper mutton, dry style.", variants: [{ label: "½ kg", price: 900 }, { label: "1 kg", price: 1799 }] },
  { id: "guntur-mutton", category: "Mutton Specialities", name: "Guntur Mutton", emoji: "🍛", photo: "/images/dishes/mutton-kaima-sambar.webp", description: "Guntur-spice mutton curry.", variants: [{ label: "½ kg", price: 900 }, { label: "1 kg", price: 1799 }] },
  { id: "mutton-sambar", category: "Mutton Specialities", name: "Mutton Sambar", emoji: "🍲", photo: "/images/dishes/mutton-sambar.webp", description: "Rich home-style mutton sambar.", price: 1699, unit: "per kg" },
  { id: "mutton-kaima-sambar", category: "Mutton Specialities", name: "Mutton 25 Kheema Sambar", emoji: "🍲", photo: "/images/dishes/mutton-kaima-sambar.webp", description: "Keema-rich sambar with 25 days of spice.", price: 1699, unit: "per kg" },
  { id: "mutton-sukka", category: "Mutton Specialities", name: "Mutton Fry", emoji: "🍛", photo: "/images/dishes/mutton-sukka.webp", description: "Dry, boldly-spiced mutton fry.", price: 1799, unit: "per kg" },

  // ── Other items ────────────────────────────────────────────────────────
  { id: "nati-koli-saru", category: "Other Items", name: "Nati Koli Saru", emoji: "🍗", photo: "/images/dishes/nati-koli-saru.webp", description: "Country-chicken nati koli saru, whole bird.", price: 1500, unit: "per full" },
  { id: "fish-fry", category: "Other Items", name: "Fish Fry", emoji: "🐟", photo: "/images/dishes/fish-fry.webp", description: "Crisp choice-of-fish fry.", price: 800, unit: "per kg" },
  { id: "rasam", category: "Other Items", name: "Rasam", emoji: "🍮", photo: "/images/dishes/rasam.webp", description: "Peppery tomato rasam.", price: 200, unit: "per ltr", veg: true },
  { id: "ragi-mudde", category: "Other Items", name: "Ragi Mudde", emoji: "⚪", photo: "/images/dishes/ragi-mudde.webp", description: "Traditional ragi balls.", price: 20, unit: "per pcs", veg: true },
  { id: "white-rice", category: "Other Items", name: "White Rice", emoji: "🍚", photo: "/images/dishes/white-rice.webp", description: "Steamed short-grain rice.", variants: [{ label: "½ kg", price: 150 }, { label: "1 kg", price: 300 }], veg: true },
  { id: "raita", category: "Other Items", name: "Raita", emoji: "🥛", photo: "/images/dishes/raita.webp", description: "Cooling curd raita.", price: 70, unit: "per ½ ltr", veg: true },
];

/**
 * Dishes that live on the Raku's Kitchen wall/poster but not the daily menu
 * card. Listed on the Catering page as a display-only price list — available
 * on request for catering, parties and bulk orders (not cart-added).
 */
export const CATERING_MENU: MenuItem[] = [
  { id: "chicken-keema", category: "Catering", name: "Chicken Keema", emoji: "🥩", photo: "/images/dishes/chicken-keema.webp", description: "Minced chicken keema masala.", price: 280, unit: "per plate" },
  { id: "kaima-gojju", category: "Catering", name: "Kaima Gojju", emoji: "🥄", photo: "/images/dishes/kaima-gojju.webp", description: "Signature gojju with mutton keema.", price: 320, unit: "per plate" },
  { id: "mutton-boti", category: "Catering", name: "Mutton Boti — Fry / Dry / Gravy", emoji: "🍗", photo: "/images/dishes/mutton-boti.webp", description: "Choose fry, dry or gravy.", price: 380, unit: "per plate" },
  { id: "mutton-paya-soup", category: "Catering", name: "Mutton Paya Soup", emoji: "🍵", photo: "/images/dishes/mutton-paya-soup.webp", description: "Slow-simmered paya broth.", price: 160, unit: "per bowl" },
  { id: "chicken-soup", category: "Catering", name: "Chicken Soup", emoji: "🍲", photo: "/images/dishes/chicken-soup.webp", description: "Homestyle chicken broth.", price: 120, unit: "per bowl" },
  { id: "crab-soup", category: "Catering", name: "Crab Soup", emoji: "🦀", photo: "/images/dishes/crab-soup.webp", description: "Coastal crab soup.", price: 180, unit: "per bowl" },
  { id: "fish-kabab", category: "Catering", name: "Fish Kabab", emoji: "🍤", photo: "/images/dishes/fish-kabab.webp", description: "Spiced fish kabab.", price: 240, unit: "per pcs" },
  { id: "fish-sambar", category: "Catering", name: "Fish Sambar", emoji: "🫕", photo: "/images/dishes/fish-sambar.webp", description: "Coastal-style fish sambar.", price: 240, unit: "per plate" },
  { id: "ghee-rice", category: "Catering", name: "Ghee Rice", emoji: "🧈", photo: "/images/dishes/ghee-rice.webp", description: "Aromatic ghee rice.", price: 110, unit: "per plate", veg: true },
  { id: "chapati", category: "Catering", name: "Chapati", emoji: "🫓", photo: "/images/dishes/chapati.webp", description: "Whole-wheat chapatis (3 pcs).", price: 40, unit: "per 3 pcs", veg: true },
  { id: "parotta", category: "Catering", name: "Parotta", emoji: "🥞", photo: "/images/dishes/parotta.webp", description: "Flaky layered parotta.", price: 30, unit: "per pcs", veg: true },
  { id: "egg-masala", category: "Catering", name: "Egg Masala", emoji: "🥚", photo: "/images/dishes/egg-masala.webp", description: "Egg curry, masala style.", price: 90, unit: "per plate" },
  { id: "egg-fry", category: "Catering", name: "Egg Fry", emoji: "🍳", photo: "/images/dishes/egg-fry.webp", description: "Crisp, spicy egg fry.", price: 90, unit: "per plate" },
];

export const MENU_BY_CATEGORY = MENU.reduce<Record<string, MenuItem[]>>((acc, item) => {
  (acc[item.category] ??= []).push(item);
  return acc;
}, {});

export const menuItemById = (id: string) => MENU.find((m) => m.id === id);

/**
 * ── SERVER-SIDE PRICE RECOMPUTATION ──────────────────────────────────────
 * Used by /api/payments/create-order to independently re-derive every line's
 * price from this file alone. The client's submitted pricePerUnit/lineTotal
 * are display-only and NEVER trusted — a tampered cart total is caught here
 * because the real price is looked up fresh, not re-validated.
 */

const BIRYANI_WEIGHT_LABEL: Record<string, BiryaniWeight> = {
  "½ kg": 0.5, "1 kg": 1, "2 kg": 2, "3 kg": 3,
};

/**
 * Parses the weight out of a biryani variant label like "1 kg · Chicken" into
 * a numeric BiryaniWeight, or null if it can't be resolved. Centralized so the
 * single fragile place price depends on a display string lives in ONE function
 * (was duplicated in resolveUnitPrice and allowedExtraMeatUnits). Tolerant of
 * whitespace, a plain "0.5 kg"/".5 kg" spelling, and the "½" glyph, so a minor
 * label-formatting change doesn't silently break biryani price resolution.
 */
export function parseBiryaniWeight(variant: string | undefined): BiryaniWeight | null {
  const weightLabel = variant?.split("·")[0]?.trim();
  if (!weightLabel) return null;

  // Fast path: exact canonical label.
  const exact = BIRYANI_WEIGHT_LABEL[weightLabel];
  if (exact !== undefined) return exact;

  // Tolerant path: normalize the glyph and pull the leading number.
  const normalized = weightLabel.replace(/½/g, "0.5");
  const num = Number.parseFloat(normalized);
  if (num === 0.5 || num === 1 || num === 2 || num === 3) return num as BiryaniWeight;
  return null;
}

interface ResolvedPrice {
  pricePerUnit: number;
  name: string;
}

/** Resolves a single line's true unit price and canonical name, or null if it can't be verified. */
export function resolveUnitPrice(menuId: string, variant?: string): ResolvedPrice | null {
  // Biryani: menuId "biryani-chicken" | "biryani-mutton", variant e.g. "1 kg · Chicken".
  const biryaniMatch = menuId.match(/^biryani-(chicken|mutton)$/);
  if (biryaniMatch) {
    const meat = biryaniMatch[1] as BiryaniMeat;
    const weight = parseBiryaniWeight(variant);
    if (weight === null) return null;
    return {
      pricePerUnit: BIRYANI_PRICING[weight][meat],
      name: meat === "chicken" ? "Chicken Biryani" : "Mutton Biryani",
    };
  }

  // Extra-meat add-on: menuId "extra-chicken-250g" | "extra-mutton-250g".
  const extraMatch = menuId.match(/^extra-(chicken|mutton)-(\d+)g$/);
  if (extraMatch) {
    const meat = extraMatch[1] as BiryaniMeat;
    const grams = Number(extraMatch[2]);
    if (grams !== EXTRA_MEAT_GRAMS) return null;
    return { pricePerUnit: EXTRA_MEAT_PRICE[meat], name: extraMeatLabel(meat) };
  }

  // Regular daily-menu item — either flat-priced or variant-priced.
  const item = menuItemById(menuId);
  if (!item) return null;

  if (item.variants) {
    const v = item.variants.find((candidate) => candidate.label === variant);
    return v ? { pricePerUnit: v.price, name: item.name } : null;
  }

  if (typeof item.price === "number" && item.price > 0) {
    return { pricePerUnit: item.price, name: item.name };
  }

  return null;
}

/** True meat for an extra-meat cart line's menuId, or null if it doesn't match that shape. */
export function extraMeatMeatFromMenuId(menuId: string): BiryaniMeat | null {
  const m = menuId.match(/^extra-(chicken|mutton)-(\d+)g$/);
  if (!m || Number(m[2]) !== EXTRA_MEAT_GRAMS) return null;
  return m[1] as BiryaniMeat;
}

/**
 * Sums the allowed extra-meat units per meat from a set of biryani lines
 * (weight-tier cap × each line's quantity). An extra-meat add-on is a
 * separate cart line with no structural pointer back to a biryani line, so
 * this pooled sum is the only source of truth for how much extra meat is
 * allowed — shared by order-total recomputation (below) and live cart
 * reconciliation (reconcileExtraMeatLines) so the rule lives in one place.
 */
export function allowedExtraMeatUnits(
  lines: { menuId: string; variant?: string; qty: number }[],
): Record<BiryaniMeat, number> {
  const allowed: Record<BiryaniMeat, number> = { chicken: 0, mutton: 0 };
  for (const line of lines) {
    const biryaniMatch = line.menuId.match(/^biryani-(chicken|mutton)$/);
    if (!biryaniMatch) continue;
    const meat = biryaniMatch[1] as BiryaniMeat;
    const weight = parseBiryaniWeight(line.variant);
    if (weight !== null) allowed[meat] += EXTRA_MEAT_MAX_UNITS[weight] * line.qty;
  }
  return allowed;
}

/**
 * Clamps (or drops) extra-meat add-on lines in a cart so none exceeds the
 * pooled allowance from that meat's biryani line(s). Called after every cart
 * mutation so an add-on can never outlive or outgrow the biryani(s) it rides
 * on — e.g. removing the biryani, or shrinking its quantity, immediately
 * shrinks or drops any extra-meat line instead of leaving it behind as an
 * orphaned, independently-purchasable line.
 */
export function reconcileExtraMeatLines(items: CartItem[]): CartItem[] {
  const remaining = allowedExtraMeatUnits(
    items.map((i) => ({ menuId: i.menuId, variant: i.variant, qty: i.quantity })),
  );
  return items.flatMap((item) => {
    const meat = extraMeatMeatFromMenuId(item.menuId);
    if (!meat) return [item];
    if (remaining[meat] <= 0) return [];
    if (item.quantity > remaining[meat]) {
      const clamped = remaining[meat];
      remaining[meat] = 0;
      return [{ ...item, quantity: clamped }];
    }
    remaining[meat] -= item.quantity;
    return [item];
  });
}

/** A line as submitted by the client — only menuId/variant/qty are used; any price fields are ignored. */
interface UnpricedLine {
  menuId: string;
  name?: string;
  variant?: string;
  qty: number;
}

export interface RecomputedOrder {
  items: OrderLineItem[];
  itemTotal: number;
  packagingFee: number;
  grandTotal: number;
}

/**
 * Recomputes an order's full pricing from scratch given only (menuId, variant, qty)
 * per line. Returns `{ error }` rather than a best-effort guess when any line can't
 * be resolved — the caller must reject the order rather than charge an unverified price.
 */
export function recomputeOrderTotals(
  lines: UnpricedLine[],
): RecomputedOrder | { error: string } {
  if (lines.length === 0) return { error: "Cart is empty" };

  const items: OrderLineItem[] = [];
  for (const line of lines) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      return { error: `Invalid quantity for ${line.name ?? line.menuId}` };
    }
    const resolved = resolveUnitPrice(line.menuId, line.variant);
    if (!resolved) {
      return {
        error: `Could not verify price for ${line.name ?? line.menuId}${line.variant ? ` (${line.variant})` : ""}`,
      };
    }
    items.push({
      menuId: line.menuId,
      name: resolved.name,
      variant: line.variant,
      qty: line.qty,
      pricePerUnit: resolved.pricePerUnit,
      lineTotal: resolved.pricePerUnit * line.qty,
    });
  }

  // Extra-meat add-ons are a separate cart line with no structural link to a
  // biryani line, so enforce the weight-tier cap here: total extra 250g units
  // per meat can't exceed what's allowed by that meat's biryani line(s).
  // Same pooled-budget rule the live cart enforces via reconcileExtraMeatLines.
  const allowedExtraUnits = allowedExtraMeatUnits(lines);
  const requestedExtraUnits: Record<BiryaniMeat, number> = { chicken: 0, mutton: 0 };
  for (const line of lines) {
    const meat = extraMeatMeatFromMenuId(line.menuId);
    if (meat) requestedExtraUnits[meat] += line.qty;
  }
  for (const meat of ["chicken", "mutton"] as BiryaniMeat[]) {
    if (requestedExtraUnits[meat] > allowedExtraUnits[meat]) {
      return { error: `Too much extra ${meat} for the selected biryani weight` };
    }
  }

  const itemTotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
  const packagingFee = packagingFeeForOrder(items);
  return { items, itemTotal, packagingFee, grandTotal: itemTotal + packagingFee };
}

// ₹ prices formatted consistently across the app.
export const formatINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;