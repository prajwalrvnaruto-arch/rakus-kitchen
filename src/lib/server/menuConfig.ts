import "server-only";
import type { Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { menuItemById } from "@/lib/menu";
import { DEFAULT_ITEM_LIMIT, deriveAvailability, itemHasQuantityLimit, quantityInLimitUnits } from "@/lib/menuLimits";
import type { OrderLineItem } from "@/types";

/**
 * ── SERVER-SIDE QUANTITY TRACKING ────────────────────────────────────────
 * One Firestore doc per menu item at menuConfig/{menuId}:
 *   { limitEnabled, limit, orderedQty, manualOverride, updatedAt }
 * Only items with itemHasQuantityLimit() (non-veg) ever get gated; every
 * item's orderedQty is tracked regardless, for the admin sales dashboard.
 */
interface MenuConfigDoc {
  limitEnabled: boolean;
  limit: number;
  orderedQty: number;
  manualOverride: "available" | "unavailable" | null;
  updatedAt: number;
}

/** Aggregates a set of order lines into per-menuId requested quantity, in
 *  that item's own limit unit — skips lines with no limit unit (add-ons). */
function aggregateRequestedQty(lines: OrderLineItem[]): Map<string, number> {
  const requested = new Map<string, number>();
  for (const line of lines) {
    const qty = quantityInLimitUnits(line.menuId, line.variant, line.qty);
    if (qty <= 0) continue;
    requested.set(line.menuId, (requested.get(line.menuId) ?? 0) + qty);
  }
  return requested;
}

/**
 * Pre-payment blocking gate, called from /api/payments/create-order BEFORE
 * the Razorpay order is created. Not itself transactional — a race between
 * two concurrent checkouts is caught for real at finalizePayment time by
 * plain best-effort counting (see the module doc on finalizePayment for why
 * that's acceptable: payment is already captured there and there's no
 * refund path, so create-order is the only place a hard rejection is safe).
 */
export async function checkQuantityLimits(
  lines: OrderLineItem[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const requested = aggregateRequestedQty(lines);
  if (requested.size === 0) return { ok: true };

  const db = adminDb();
  const menuIds = Array.from(requested.keys());
  const snaps = await db.getAll(...menuIds.map((id) => db.collection("menuConfig").doc(id)));

  for (let i = 0; i < menuIds.length; i++) {
    const menuId = menuIds[i];
    const item = menuItemById(menuId);
    if (!item || !itemHasQuantityLimit(item)) continue; // veg / unknown items are never gated

    const data = snaps[i].data() as MenuConfigDoc | undefined;
    const orderedQty = data?.orderedQty ?? 0;
    const limit = data?.limit ?? DEFAULT_ITEM_LIMIT;
    const manualOverride = data?.manualOverride ?? null;

    if (manualOverride === "unavailable") {
      return { ok: false, error: `${item.name} is currently unavailable.` };
    }

    const wanted = requested.get(menuId)!;
    const remaining = limit - orderedQty;
    if (manualOverride !== "available" && wanted > remaining) {
      const unit = item.unit === "per full" ? "" : "kg";
      return {
        ok: false,
        error: remaining > 0
          ? `${item.name} has only ${remaining}${unit} left before today's limit.`
          : `${item.name} has reached today's order limit.`,
      };
    }
  }

  return { ok: true };
}

/**
/**
 * Reads all touched menu config docs inside tx BEFORE any transaction writes occur.
 * Returns a commit function that applies all tx.set() / tx.update() writes.
 * This guarantees strict compliance with Firestore's "all reads before all writes" rule.
 */
export async function prepareMenuQuantityIncrements(
  tx: Transaction,
  lines: OrderLineItem[],
): Promise<() => void> {
  const requested = aggregateRequestedQty(lines);
  if (requested.size === 0) return () => {};

  const db = adminDb();
  const menuIds = Array.from(requested.keys());
  const refs = menuIds.map((id) => db.collection("menuConfig").doc(id));
  const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

  return () => {
    for (let i = 0; i < menuIds.length; i++) {
      const menuId = menuIds[i];
      const delta = requested.get(menuId)!;
      const snap = snaps[i];
      const item = menuItemById(menuId);

      if (!snap.exists) {
        tx.set(refs[i], {
          limitEnabled: item ? itemHasQuantityLimit(item) : false,
          limit: DEFAULT_ITEM_LIMIT,
          orderedQty: delta,
          manualOverride: null,
          updatedAt: Date.now(),
        } satisfies MenuConfigDoc);
      } else {
        tx.update(refs[i], {
          orderedQty: FieldValue.increment(delta),
          updatedAt: Date.now(),
        });
      }
    }
  };
}

/** Legacy wrapper if used outside an ordered read/write transaction sequence. */
export async function incrementMenuQuantities(
  tx: Transaction,
  lines: OrderLineItem[],
): Promise<void> {
  const commit = await prepareMenuQuantityIncrements(tx, lines);
  commit();
}

export { DEFAULT_ITEM_LIMIT, deriveAvailability, itemHasQuantityLimit };
export type { MenuConfigDoc };
