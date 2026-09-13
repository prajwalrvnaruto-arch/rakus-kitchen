import type { BiryaniMeat, BiryaniWeight, MenuItem, OrderLineItem } from "@/types";

export const PACKAGING_FEE_PER_UNIT = 20;

/**
 * ── PRICING — SINGLE SOURCE OF TRUTH ─────────────────────────────────────
 * Only biryani prices are confirmed by the business (see rakuskitchen_info.txt).
 * Everything else carries a MARKED PLACEHOLDER price so the site is fully
 * orderable from day one. Confirm each with the business and delete the
 * `placeholder: true` flag when done.
 */

// Confirmed: Chicken Biryani ₹400 (½kg) · ₹800 (1kg) — per-kg rate.
// 2kg/3kg extrapolated at the per-kg rate (₹800/kg chicken, ₹1,600/kg mutton).
export const BIRYANI_PRICING: Record<BiryaniWeight, Record<BiryaniMeat, number>> = {
  0.5: { chicken: 400, mutton: 800 },
  1: { chicken: 800, mutton: 1600 },
  2: { chicken: 1600, mutton: 3200 },
  3: { chicken: 2400, mutton: 4800 },
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
  { id: "andhra-chilli-chicken", category: "Chicken Specialities", name: "Andhra Chilli Chicken", emoji: "🌶️", photo: "/images/dishes/andhra-chilli-chicken.webp", description: "Fiery Andhra-style chilli chicken.", price: 260, placeholder: true, unit: "per plate" },
  { id: "guntur-chicken", category: "Chicken Specialities", name: "Guntur Chicken", emoji: "🍛", photo: "/images/dishes/guntur-chicken.webp", description: "Spicy Guntur-style chicken curry.", price: 260, placeholder: true, unit: "per plate" },
  { id: "chicken-chops", category: "Chicken Specialities", name: "Chicken Chops", emoji: "🍖", photo: "/images/dishes/chicken-chops.webp", description: "Crisp, juicy chicken chops.", price: 280, placeholder: true, unit: "per plate" },
  { id: "chicken-kabab", category: "Chicken Specialities", name: "Chicken Kabab", emoji: "🥙", photo: "/images/dishes/chicken-kabab.webp", description: "Char-grilled chicken kabab.", price: 280, placeholder: true, unit: "per plate" },
  { id: "kshatriya-kabab", category: "Chicken Specialities", name: "Kshatriya Kabab", emoji: "🍢", photo: "/images/dishes/kshatriya-kabab.webp", description: "A signature spiced kabab.", price: 300, placeholder: true, unit: "per plate" },
  { id: "pepper-chicken", category: "Chicken Specialities", name: "Pepper Chicken", emoji: "🌶️", photo: "/images/dishes/pepper-chicken.webp", description: "Kozhi-milagu style cracked pepper chicken.", price: 260, placeholder: true, unit: "per plate" },
  { id: "chicken-sambar", category: "Chicken Specialities", name: "Chicken Sambar", emoji: "🍜", photo: "/images/dishes/chicken-sambar.webp", description: "Home-style chicken sambar.", price: 240, placeholder: true, unit: "per plate" },
  { id: "chicken-keema", category: "Chicken Specialities", name: "Chicken Keema", emoji: "🥩", photo: "/images/dishes/chicken-keema.webp", description: "Minced chicken keema masala.", price: 280, placeholder: true, unit: "per plate" },

  // ── Mutton specialities ────────────────────────────────────────────────
  { id: "mutton-sambar", category: "Mutton Specialities", name: "Mutton Sambar", emoji: "🍲", photo: "/images/dishes/mutton-sambar.webp", description: "Rich home-style mutton sambar.", price: 320, placeholder: true, unit: "per plate" },
  { id: "mutton-chops", category: "Mutton Specialities", name: "Mutton Chops", emoji: "🍖", photo: "/images/dishes/mutton-chops.webp", description: "Tender Nati-style mutton chops.", price: 340, placeholder: true, unit: "per plate" },
  { id: "mutton-kaima-sambar", category: "Mutton Specialities", name: "Mutton Kaima Sambar", emoji: "🍲", photo: "/images/dishes/mutton-kaima-sambar.webp", description: "Keema-rich kaima sambar.", price: 340, placeholder: true, unit: "per plate" },
  { id: "kaima-gojju", category: "Mutton Specialities", name: "Kaima Gojju", emoji: "🥄", photo: "/images/dishes/kaima-gojju.webp", description: "Signature gojju with mutton keema.", price: 320, placeholder: true, unit: "per plate" },
  { id: "mutton-boti", category: "Mutton Specialities", name: "Mutton Boti — Fry / Dry / Gravy", emoji: "🍗", photo: "/images/dishes/mutton-boti.webp", description: "Choose fry, dry or gravy.", price: 380, placeholder: true, unit: "per plate" },
  { id: "mutton-sukka", category: "Mutton Specialities", name: "Mutton Sukka", emoji: "🍛", photo: "/images/dishes/mutton-sukka.webp", description: "Dry, boldly-spiced mutton sukka.", price: 360, placeholder: true, unit: "per plate" },

  // ── Fish ───────────────────────────────────────────────────────────────
  { id: "fish-fry", category: "Fish", name: "Fish Fry", emoji: "🐟", photo: "/images/dishes/fish-fry.webp", description: "Crisp choice-of-fish fry.", price: 220, placeholder: true, unit: "per pcs" },
  { id: "fish-kabab", category: "Fish", name: "Fish Kabab", emoji: "🍤", photo: "/images/dishes/fish-kabab.webp", description: "Spiced fish kabab.", price: 240, placeholder: true, unit: "per pcs" },
  { id: "fish-sambar", category: "Fish", name: "Fish Sambar", emoji: "🫕", photo: "/images/dishes/fish-sambar.webp", description: "Coastal-style fish sambar.", price: 240, placeholder: true, unit: "per plate" },

  // ── Rice & breads ──────────────────────────────────────────────────────
  { id: "white-rice", category: "Rice & Breads", name: "White Rice", emoji: "🍚", photo: "/images/dishes/white-rice.webp", description: "Steamed short-grain rice.", price: 60, placeholder: true, unit: "per plate", veg: true },
  { id: "ghee-rice", category: "Rice & Breads", name: "Ghee Rice", emoji: "🧈", description: "Aromatic ghee rice.", price: 110, placeholder: true, unit: "per plate", veg: true },
  { id: "ragi-mudde", category: "Rice & Breads", name: "Ragi Mudde", emoji: "⚪", description: "Traditional ragi balls.", price: 60, placeholder: true, unit: "per plate", veg: true },
  { id: "chapati", category: "Rice & Breads", name: "Chapati", emoji: "🫓", description: "Whole-wheat chapatis (3 pcs).", price: 40, placeholder: true, unit: "per 3 pcs", veg: true },
  { id: "parotta", category: "Rice & Breads", name: "Parotta", emoji: "🥞", description: "Flaky layered parotta.", price: 30, placeholder: true, unit: "per pcs", veg: true },

  // ── Sides & add-ons ────────────────────────────────────────────────────
  { id: "rasam", category: "Sides & Add-ons", name: "Rasam", emoji: "🍮", description: "Peppery tomato rasam.", price: 60, placeholder: true, unit: "per bowl", veg: true },
  { id: "raita", category: "Sides & Add-ons", name: "Raita", emoji: "🥛", description: "Cooling curd raita.", price: 60, placeholder: true, unit: "per bowl", veg: true },
  { id: "egg-masala", category: "Sides & Add-ons", name: "Egg — Masala", emoji: "🥚", description: "Egg curry, masala style.", price: 90, placeholder: true, unit: "per plate" },
  { id: "egg-fry", category: "Sides & Add-ons", name: "Egg — Fry", emoji: "🍳", description: "Crisp, spicy egg fry.", price: 90, placeholder: true, unit: "per plate" },

  // ── Soups ──────────────────────────────────────────────────────────────
  { id: "mutton-paya-soup", category: "Soups", name: "Mutton Paya Soup", emoji: "🍵", description: "Slow-simmered paya broth.", price: 160, placeholder: true, unit: "per bowl" },
  { id: "chicken-soup", category: "Soups", name: "Chicken Soup", emoji: "🍲", description: "Homestyle chicken broth.", price: 120, placeholder: true, unit: "per bowl" },
  { id: "crab-soup", category: "Soups", name: "Crab Soup", emoji: "🦀", description: "Coastal crab soup.", price: 180, placeholder: true, unit: "per bowl" },
];

export const MENU_BY_CATEGORY = MENU.reduce<Record<string, MenuItem[]>>((acc, item) => {
  (acc[item.category] ??= []).push(item);
  return acc;
}, {});

export const menuItemById = (id: string) => MENU.find((m) => m.id === id);

// ₹ prices formatted consistently across the app.
export const formatINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;