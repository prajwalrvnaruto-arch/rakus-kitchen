import { MENU } from "@/lib/menu";
import type { OrderLineItem } from "@/types";

/**
 * Pure prep-sheet aggregation — no React, no Firebase, no PII. Shared by the
 * kitchen page's renderer (client) and the /api/kitchen/prep endpoint (server),
 * so both produce identical prep rows from the same order line items. The
 * server runs this and sends only the result to kitchen staff; customer names,
 * phones and addresses never leave the server.
 */

/**
 * Index the menu by id so the prep sheet reads a dish's real category and unit
 * instead of guessing them from the menuId. Order-line menuIds for biryani
 * carry a weight suffix (biryani-chicken-1kg → base biryani-chicken) and extra
 * meat is "extra-chicken-250g"; everything else matches a MENU id directly.
 */
const MENU_BY_ID = new Map(MENU.map((m) => [m.id, m]));

function lookupMenu(menuId: string) {
  if (MENU_BY_ID.has(menuId)) return MENU_BY_ID.get(menuId);
  if (menuId.startsWith("biryani-chicken")) return MENU_BY_ID.get("biryani-chicken");
  if (menuId.startsWith("biryani-mutton")) return MENU_BY_ID.get("biryani-mutton");
  return undefined;
}

/** true when a dish is sold by weight with no size variant (unit "per kg"),
 *  e.g. Fish Fry, the sambars, Mutton Fry — each order line is already in kg. */
function isPerKg(menuId: string): boolean {
  return lookupMenu(menuId)?.unit === "per kg";
}

/**
 * A single line in the aggregated prep sheet — represents one item (or add-on)
 * with its total quantity summed across all orders in the slot.
 */
export interface PrepRow {
  menuId: string;
  name: string;
  variant?: string;
  category: string;
  isAddon: boolean;
  totalQty: number;
  totalWeightKg?: number; // only for weight-variant items (biryani)
  unit?: string; // e.g. "pieces", "portions" for non-weight items
}

export interface SlotPrepSummary {
  slot: "Lunch" | "Dinner";
  orderCount: number;
  totalItems: number;
  rows: PrepRow[];
}

/**
 * Parse the weight from a variant label like "½ kg · Chicken" or "1 kg · Mutton"
 * into a numeric kilogram value, or null if it can't be resolved.
 */
function parseWeightFromVariant(variant?: string): number | null {
  if (!variant) return null;
  const weightPart = variant.split("·")[0]?.trim();
  if (!weightPart) return null;

  // Normalize the ½ glyph to 0.5, then accept any positive kg value — menus
  // may carry sizes beyond the usual 0.5/1/2/3 (e.g. an odd 1.5 kg biryani),
  // and dropping those would silently understate the kitchen's prep weight.
  const normalized = weightPart.replace(/½/g, "0.5");
  const num = Number.parseFloat(normalized);
  if (Number.isFinite(num) && num > 0 && /kg/i.test(weightPart)) return num;
  return null;
}

/**
 * Aggregate all orders' items into a combined prep sheet for a single slot.
 * Excludes cancelled orders, groups by (menuId + variant), sums quantities,
 * and identifies add-on lines (menuId starting with "extra-").
 */
export function aggregatePrepQuantities(
  ordersInSlot: Array<{ items: OrderLineItem[] }>,
): PrepRow[] {
  const groups: Map<string, PrepRow> = new Map();

  // Group by menuId + variant, summing quantities
  for (const order of ordersInSlot) {
    for (const item of order.items) {
      const key = `${item.menuId}|${item.variant ?? ""}`;

      // Per-kg dishes (Fish Fry, sambars, Mutton Fry) have no size variant —
      // the quantity itself is a kg count, so each unit of qty is 1 kg.
      const perKg = isPerKg(item.menuId);
      const unitWeightKg = parseWeightFromVariant(item.variant) ?? (perKg ? 1 : null);

      if (groups.has(key)) {
        const existing = groups.get(key)!;
        existing.totalQty += item.qty;
        if (existing.totalWeightKg !== undefined && unitWeightKg !== null) {
          existing.totalWeightKg += unitWeightKg * item.qty;
        }
      } else {
        const isAddon = item.menuId.startsWith("extra-");

        groups.set(key, {
          menuId: item.menuId,
          name: item.name,
          variant: item.variant,
          category: deriveCategory(item.menuId),
          isAddon,
          totalQty: item.qty,
          totalWeightKg: unitWeightKg !== null ? unitWeightKg * item.qty : undefined,
          unit: deriveUnit(item.menuId),
        });
      }
    }
  }

  // Sort: biryani first, then other categories, then add-ons at the bottom
  const rows = Array.from(groups.values());
  rows.sort((a, b) => {
    if (a.isAddon && !b.isAddon) return 1;
    if (!a.isAddon && b.isAddon) return -1;
    if (a.category !== b.category) {
      const catOrder: Record<string, number> = {
        Biryani: 0,
        "Chicken Specialities": 1,
        "Mutton Specialities": 2,
        "Other Items": 3,
      };
      const orderA = catOrder[a.category] ?? 99;
      const orderB = catOrder[b.category] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
    }
    return a.name.localeCompare(b.name);
  });

  return rows;
}

/**
 * The dish's category, read from the menu. Add-ons ("extra-…") are their own
 * group; anything the menu doesn't know falls back to "Other Items" so an
 * unexpected menuId still renders instead of being dropped.
 */
function deriveCategory(menuId: string): string {
  if (menuId.startsWith("extra-")) return "Add-ons";
  return lookupMenu(menuId)?.category ?? "Other Items";
}

/**
 * The unit label shown after a quantity (e.g. "4 × pcs", "2 × whole bird(s)").
 * Derived from the menu's own `unit` string ("per kg" → "kg", "per pcs" →
 * "pcs", "per full" → "whole bird(s)"). Weight-variant items are shown in kg
 * by the row renderer, so this only matters for no-variant items.
 */
function deriveUnit(menuId: string): string {
  const unit = lookupMenu(menuId)?.unit;
  if (!unit) return "unit(s)";
  if (unit === "per full") return "whole bird(s)";
  // "per kg" → "kg", "per ltr" → "ltr", "per ½ ltr" → "½ ltr", "per pcs" → "pcs", "per 3 pcs" → "3 pcs"
  return unit.replace(/^per\s+/, "");
}

/**
 * Sum the total kg per dish across all its weight variants, e.g.
 * Chicken Biryani ½ kg × 10 + 1 kg × 5 → 10 kg. Extra-meat add-ons
 * ("extra-chicken-250g") count by their gram size as their own line, e.g.
 * 3 × 250 g → Extra Chicken 0.75 kg. Per-unit items (Ragi Mudde, Rasam, …)
 * are left out. Keeps the prep-sheet row order (biryani first, add-ons last).
 */
export function totalWeightByDish(rows: PrepRow[]): Array<{ key: string; name: string; kg: number }> {
  const totals = new Map<string, { key: string; name: string; kg: number }>();
  const add = (key: string, name: string, kg: number) => {
    const existing = totals.get(key);
    if (existing) existing.kg += kg;
    else totals.set(key, { key, name, kg });
  };

  for (const row of rows) {
    if (row.isAddon) {
      const m = row.menuId.match(/^extra-(chicken|mutton)-(\d+)g$/);
      if (!m) continue;
      const meat = m[1] === "chicken" ? "Chicken" : "Mutton";
      add(`extra-${m[1]}`, `Extra ${meat}`, (Number(m[2]) / 1000) * row.totalQty);
    } else if (row.totalWeightKg !== undefined) {
      add(row.menuId, row.name, row.totalWeightKg);
    }
  }
  return Array.from(totals.values());
}

// Up to 2 decimals, trailing zeros dropped: 10 → "10 kg", 2.5 → "2.5 kg", 0.75 → "0.75 kg".
export const formatKg = (kg: number) => `${Number.parseFloat(kg.toFixed(2))} kg`;

/**
 * Build the two slot summaries from a day's orders. Cancelled orders are
 * excluded entirely (they never contribute prep quantities). This is the whole
 * client-visible payload for the kitchen prep sheet — no PII crosses here.
 */
export function buildSlotSummaries(
  orders: Array<{ mealSlot?: string; status?: string; items: OrderLineItem[] }>,
): { lunch: SlotPrepSummary; dinner: SlotPrepSummary } {
  const active = orders.filter((o) => o.status !== "Cancelled");
  const summarize = (slot: "Lunch" | "Dinner"): SlotPrepSummary => {
    const inSlot = active.filter((o) => o.mealSlot === slot);
    return {
      slot,
      orderCount: inSlot.length,
      totalItems: inSlot.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.qty, 0), 0),
      rows: aggregatePrepQuantities(inSlot),
    };
  };
  return { lunch: summarize("Lunch"), dinner: summarize("Dinner") };
}
