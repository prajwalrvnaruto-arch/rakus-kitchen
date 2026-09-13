import type { BiryaniMeat, BiryaniWeight, MenuItem, OrderLineItem } from "@/types";

export const PACKAGING_FEE_PER_UNIT = 20;

/**
 * ── PRICING — SINGLE SOURCE OF TRUTH ─────────────────────────────────────
 * All prices below are verified against the official Raku's Kitchen menu card.
 * Weighted dishes (½ kg / 1 kg) use `variants`; every item is orderable with a
 * confirmed price — no placeholders remain.
 */

// Confirmed biryani card pricing: Chicken ₹400 (½kg) · ₹799 (1kg),
// Mutton ₹799 (½kg) · ₹1,599 (1kg). 2kg/3kg extrapolated at the per-kg rate.
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

// ₹ prices formatted consistently across the app.
export const formatINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;