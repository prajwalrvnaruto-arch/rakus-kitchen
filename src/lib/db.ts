"use client";

import {
  addDoc, collection, doc, getDoc, getDocs,
  limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc,
  startAfter, updateDoc, where, writeBatch, type Unsubscribe, type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getIdToken, getIdTokenResult } from "firebase/auth";
import { auth, db } from "./firebase";
import { sanitizeFirestoreData } from "./sanitize";
import { recordAuditLog } from "./auditLogger";
import type { MenuItemConfig } from "./menuLimits";
import type { AddressComponents, DeliveryMeta, FulfillmentType, Order, OrderLineItem, OrderStatus, PaymentMeta, StatusEvent } from "@/types";

/* ── Order creation ────────────────────────────────────────────────────── */
//
// Order documents are now created SERVER-SIDE ONLY, after a verified Razorpay
// payment — see src/lib/server/paymentIntents.ts and the /api/payments/*
// routes. This keeps the OrderDraft shape (still used to build the payment
// request from the checkout form) but there is no client-side createOrder
// anymore; firestore.rules denies client `create` on /orders outright.

export interface OrderDraft {
  customerName: string;
  phone: string;
  deliveryAddress: string;
  /** Structured geo-coded address — collected by AddressPicker. */
  addressComponents?: AddressComponents;
  /** "delivery" (default) or "pickup" — pickup orders carry no delivery address. */
  fulfillmentType: FulfillmentType;
  mealSlot: "Lunch" | "Dinner";
  mealDate: string; // YYYY-MM-DD
  items: OrderLineItem[];
  itemTotal: number;
  packagingFee: number;
  grandTotal: number;
  notes?: string;
}

/* ── Reads (live) ──────────────────────────────────────────────────────── */

export function subscribeMyOrders(
  customerId: string,
  onOrders: (orders: Order[]) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, "orders"), where("customerId", "==", customerId));
  return retryingListener("subscribeMyOrders", (onSnapshotError) =>
    onSnapshot(
      q,
      (snap) => {
        const orders = snap.docs.map(mapOrder).sort((a, b) => b.createdAt - a.createdAt);
        onOrders(orders);
      },
      onSnapshotError,
    ),
    onError,
  );
}

// How many most-recent orders the live admin dashboard listener keeps subscribed
// to. This is what stops subscribeAllOrders from downloading the full order
// history as volume grows — the listener is capped by document count (not a
// date window, since Firestore can't combine "most recent N" with a plain date
// range without a composite index). 500 comfortably covers the live kitchen
// view (active + recently archived orders); it is NOT used for Analytics "All
// Time" / CSV export, which calls fetchAllOrdersOnce below instead.
const LIVE_ORDERS_LIMIT = 500;

export function subscribeAllOrders(
  onOrders: (orders: Order[]) => void,
  onError?: (message: string) => void,
  /** Fired with orders that arrived live AFTER the initial load — used to alert
   *  the kitchen. Never fired for the first snapshot (the existing backlog), so
   *  opening the dashboard doesn't blast an alert for every order already there. */
  onNewOrders?: (orders: Order[]) => void,
): Unsubscribe {
  if (!db) return () => {};
  const firestore = db;
  // Skip alerting on the first snapshot: it delivers the whole existing
  // collection as "added" changes, which are not genuinely new orders.
  // Re-created on each retry via the closure below.
  let seededFirstSnapshot = false;
  const knownOrderIds = new Set<string>();

  const q = query(
    collection(firestore, "orders"),
    orderBy("createdAt", "desc"),
    limit(LIVE_ORDERS_LIMIT),
  );

  return retryingListener("subscribeAllOrders", (onSnapshotError) =>
    onSnapshot(
      q,
      (snap) => {
        const orders = snap.docs.map(mapOrder).sort((a, b) => b.createdAt - a.createdAt);
        onOrders(orders);

        if (!seededFirstSnapshot) {
          // First snapshot = existing backlog. Seed known IDs and don't alert.
          snap.docs.forEach((d) => knownOrderIds.add(d.id));
          seededFirstSnapshot = true;
          return;
        }
        if (!onNewOrders) return;

        // Collect newly added orders (skipping local pending writes). Only
        // orders still at the pre-acceptance "Confirmed" stage belong in the
        // kitchen alert queue — anything already moved past that (Preparing,
        // Out for Delivery, Delivered, Cancelled, ...) has already been
        // actioned, so it must never (re-)trigger an "Accept" alert. Without
        // this guard, a page refresh re-subscribes with fresh in-memory
        // dedup state (knownOrderIds/seededFirstSnapshot both reset), and
        // this listener's own "added" docChange for an order that was simply
        // reordered within the window by its updatedAt-independent position,
        // or any other snapshot replay, could resurface an already-accepted
        // order as if it were brand new.
        const freshOrders: Order[] = [];
        for (const change of snap.docChanges()) {
          if (
            change.type === "added" &&
            !change.doc.metadata.hasPendingWrites &&
            !knownOrderIds.has(change.doc.id)
          ) {
            const order = mapOrder(change.doc);
            if (order.status === "Confirmed") freshOrders.push(order);
            knownOrderIds.add(change.doc.id);
          }
        }

        // Robust fallback: also check if any document was not previously known
        for (const doc of snap.docs) {
          if (!knownOrderIds.has(doc.id) && !doc.metadata.hasPendingWrites) {
            const order = mapOrder(doc);
            if (order.status === "Confirmed") freshOrders.push(order);
            knownOrderIds.add(doc.id);
          }
        }

        if (freshOrders.length > 0) {
          const uniqueFresh = Array.from(new Map(freshOrders.map((o) => [o.id, o])).values());
          onNewOrders(uniqueFresh);
        }
      },
      onSnapshotError,
    ),
    onError,
  );
}

/**
 * One-time (non-live) fetch of the FULL order history, ordered newest-first.
 * Used only by AdminAnalyticsTab's "All Time" preset and CSV export, which
 * need true lifetime totals — unlike the live dashboard feed (subscribeAllOrders),
 * which is capped at LIVE_ORDERS_LIMIT most-recent orders to bound listener cost.
 * Paginates via startAfter in LIVE_ORDERS_LIMIT-sized pages so a large history
 * doesn't require a single unbounded query.
 */
export async function fetchAllOrdersOnce(): Promise<Order[]> {
  if (!db) return [];
  const firestore = db;
  const all: Order[] = [];
  let cursor: QueryDocumentSnapshot | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const q = cursor
      ? query(collection(firestore, "orders"), orderBy("createdAt", "desc"), startAfter(cursor), limit(LIVE_ORDERS_LIMIT))
      : query(collection(firestore, "orders"), orderBy("createdAt", "desc"), limit(LIVE_ORDERS_LIMIT));
    const snap = await getDocs(q);
    if (snap.empty) break;
    all.push(...snap.docs.map(mapOrder));
    if (snap.docs.length < LIVE_ORDERS_LIMIT) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  return all;
}

/**
 * A Firestore onSnapshot wrapper that survives transient failures. A denied listen does
 * not auto-retry in the SDK — the listener is dead the moment its error handler fires.
 * On error we tear it down and re-establish it after a short delay, so a cold page load
 * racing auth-token restore (or a rules-propagation window) recovers on its own instead
 * of leaving the UI stuck at zero orders. Errors are swallowed (never re-thrown) to avoid
 * the SDK internal-state corruption unhandled rejections used to cause.
 */
export function retryingListener(
  label: string,
  open: (onSnapshotError: (err: { message: string }) => void) => Unsubscribe,
  onError?: (message: string) => void,
): Unsubscribe {
  if (!db) return () => {};
  let disposed = false;
  let unsubscribe: Unsubscribe | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const listen = () => {
    unsubscribe = open((err) => {
      if (disposed) return;
      console.warn(`${label}: snapshot error — retrying in 2s:`, err.message);
      onError?.(err.message);
      unsubscribe?.();
      retryTimer = setTimeout(listen, 2000);
    });
  };

  listen();
  return () => {
    disposed = true;
    if (retryTimer) clearTimeout(retryTimer);
    unsubscribe?.();
  };
}

/* ── Status updates (admin) ────────────────────────────────────────────── */

/**
 * Updates an order's status (admin only). Reads the current statusHistory first so it
 * can append rather than overwrite. Each operation is wrapped separately so a failure
 * is attributed to the exact step (read vs write) instead of a generic "update failed".
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  by?: string,
): Promise<void> {
  if (!db || !auth) return;
  const ref = doc(db, "orders", orderId);

  // Force-refresh the Firebase ID token before any Firestore write.
  // Tokens expire after 1 hour; a stale token causes Firestore to return
  // permission-denied even when the /admins doc exists and rules are correct.
  // This is the #1 silent cause of "WRITE step failed" after a long session.
  if (auth.currentUser) {
    try {
      await getIdToken(auth.currentUser, /* forceRefresh */ true);
    } catch (e) {
      console.warn("[updateOrderStatus] token refresh failed — proceeding with current token:", e);
    }
  }

  let history: StatusEvent[];
  try {
    const snap = await getDoc(ref);
    history = snap.data()?.statusHistory as StatusEvent[] ?? [];
  } catch (err) {
    const e = err as { code?: string; message?: string };
    throw new Error(
      `READ step failed (permission-denied here means the console READ rule is stale, ` +
      `not the update rule): ${e.code ?? ""} ${e.message ?? ""}`.trim(),
    );
  }

  // Verify the /admins doc exists before attempting the write.
  // If READ passed via the owner branch but this user has no admin doc,
  // the write will always fail — catch it early with a clear message.
  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      const adminSnap = await getDoc(doc(db, "admins", uid));
      if (!adminSnap.exists()) {
        throw new Error(
          `WRITE blocked: your account (${uid}) has no /admins/${uid} document in Firestore. ` +
          `Open the Admin panel → "Verify admin access" → "Bootstrap admin doc" to create it, ` +
          `or add it manually in the Firebase Console under Firestore → admins → ${uid} → { role: "admin" }.`,
        );
      }
    } catch (err) {
      // Re-throw our own structured message; swallow read-denied (will surface in the write anyway).
      if ((err as Error).message.startsWith("WRITE blocked:")) throw err;
      console.warn("[updateOrderStatus] couldn't pre-check /admins doc — proceeding:", err);
    }
  }

  const actorEmail = by || auth.currentUser?.email || auth.currentUser?.uid || "admin";
  const newEvent: StatusEvent = {
    status,
    at: Date.now(),
    ...(actorEmail ? { by: actorEmail } : {}),
  };

  try {
    await updateDoc(ref, {
      status,
      statusHistory: [...history, newEvent],
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    throw new Error(
      `Failed to update order status in Firestore: ${e.code ?? ""} ${e.message ?? ""}`.trim(),
    );
  }

  // Asynchronously record an audit trail entry (non-blocking)
  recordAuditLog({
    action: status === "Cancelled" ? "order.cancelled" : "order.status_changed",
    actor: {
      uid: auth.currentUser?.uid,
      email: auth.currentUser?.email ?? undefined,
      type: "admin",
    },
    targetId: orderId,
    summary: `Order status set to "${status}" by ${actorEmail}`,
    metadata: { status, orderId },
  }).catch(() => {});
}

/* ── Admin allowlist bootstrap ─────────────────────────────────────────── */

/** Add (or remove) a uid from the admins allowlist: setAdmin("5bdmfFawjOTWKq7i8kshgVRFrbe2", true). */
export async function setAdmin(uid: string, active: boolean): Promise<void> {
  if (!db) return;
  const ref = doc(db, "admins", uid);
  if (active) {
    await setDoc(ref, { role: "admin" });
  } else {
    const snap = await getDoc(ref);
    if (snap.exists()) await updateDoc(ref, { active: false });
  }
}

/* ── Mapper ────────────────────────────────────────────────────────────── */

function mapOrder(doc: { id: string; data: () => Record<string, unknown> }): Order {
  const d = doc.data();
  const createdAt = (d.createdAt as { seconds?: number } | number) ?? 0;
  const updatedAt = (d.updatedAt as { seconds?: number } | number) ?? 0;
  const toEpoch = (v: { seconds?: number } | number | undefined) =>
    typeof v === "number" ? v : (v?.seconds ?? 0) * 1000;

  return {
    id: doc.id,
    orderId: (d.orderId as string) ?? doc.id,
    customerId: (d.customerId as string) ?? "",
    customerName: (d.customerName as string) ?? "",
    phone: (d.phone as string) ?? "",
    deliveryAddress: (d.deliveryAddress as string) ?? "",
    // New structured address — undefined for legacy orders (backward compat).
    addressComponents: d.addressComponents
      ? (d.addressComponents as AddressComponents)
      : undefined,
    // Carrier booking metadata — undefined until admin books a ride.
    deliveryMeta: d.deliveryMeta
      ? (d.deliveryMeta as DeliveryMeta)
      : undefined,
    // Backward compat: orders placed before this feature shipped had no
    // fulfillmentType field at all — they were all deliveries.
    fulfillmentType: (d.fulfillmentType as FulfillmentType) ?? "delivery",
    mealSlot: (d.mealSlot as "Lunch" | "Dinner") ?? "Lunch",
    mealDate: (d.mealDate as string) ?? "",
    items: (d.items as OrderLineItem[]) ?? [],
    itemTotal: (d.itemTotal as number) ?? 0,
    packagingFee: (d.packagingFee as number) ?? 0,
    grandTotal: (d.grandTotal as number) ?? 0,
    status: (d.status as OrderStatus) ?? "Confirmed",
    statusHistory: (d.statusHistory as StatusEvent[]) ?? [],
    notes: (d.notes as string) ?? undefined,
    // Razorpay payment record — undefined for legacy pre-Razorpay orders.
    payment: d.payment ? (d.payment as PaymentMeta) : undefined,
    createdAt: toEpoch(createdAt),
    updatedAt: toEpoch(updatedAt),
  };
}

/**
 * Writes carrier booking metadata (Porter order ID, fare estimate, tracking URL)
 * back onto the order document after the admin clicks "Book Delivery".
 * Uses a partial update so no other order fields are touched.
 */
export async function updateDeliveryMeta(
  docId: string,
  meta: Partial<DeliveryMeta>,
): Promise<void> {
  if (!db) return;
  // Firestore rejects undefined values — strip them before writing.
  const clean = Object.fromEntries(
    Object.entries(meta).filter(([, v]) => v !== undefined),
  );
  await updateDoc(doc(db, "orders", docId), {
    deliveryMeta: clean,
    updatedAt: serverTimestamp(),
  });

  if (meta.carrierOrderId) {
    recordAuditLog({
      action: "courier.booked",
      actor: {
        uid: auth?.currentUser?.uid,
        email: auth?.currentUser?.email ?? undefined,
        type: "admin",
      },
      targetId: docId,
      summary: `Booked ${meta.carrierId || "courier"} delivery (Carrier Order #${meta.carrierOrderId})`,
      metadata: { docId, ...meta },
    }).catch(() => {});
  }
}

// Re-exported for the rare case admin tools want a one-off order fetch.
export async function getOrder(orderId: string): Promise<Order | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "orders", orderId));
  return snap.exists() ? mapOrder(snap) : null;
}

/* ── Menu item quantity limits / availability (admin inventory) ──────────── */
//
// One doc per menu item at menuConfig/{menuId}: { limitEnabled, limit,
// orderedQty, manualOverride, updatedAt }. orderedQty is incremented
// server-side only (inside finalizePayment's transaction, see
// src/lib/server/menuConfig.ts) — never decremented, per the business
// decision that cancellations don't release quantity. These functions cover
// everything the admin inventory page needs: live read, per-item limit/
// override edits, and manual reset (no automatic/scheduled reset exists).

export interface MenuConfigWithId extends MenuItemConfig {
  menuId: string;
}

export function subscribeMenuConfig(
  onData: (configs: MenuConfigWithId[]) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  if (!db) return () => {};
  const firestore = db;
  return retryingListener("subscribeMenuConfig", (onSnapshotError) =>
    onSnapshot(
      collection(firestore, "menuConfig"),
      (snap) => {
        const configs = snap.docs.map((d) => ({ menuId: d.id, ...(d.data() as MenuItemConfig) }));
        onData(configs);
      },
      onSnapshotError,
    ),
    onError,
  );
}

export async function setMenuItemLimit(menuId: string, limit: number): Promise<void> {
  if (!db) return;
  await setDoc(
    doc(db, "menuConfig", menuId),
    { limit, updatedAt: serverTimestamp() },
    { merge: true },
  );
  recordAuditLog({
    action: "inventory.limit_changed",
    actor: {
      uid: auth?.currentUser?.uid,
      email: auth?.currentUser?.email ?? undefined,
      type: "admin",
    },
    targetId: menuId,
    summary: `Menu limit for "${menuId}" set to ${limit}`,
    metadata: { menuId, limit },
  }).catch(() => {});
}

export async function setMenuItemAvailabilityOverride(
  menuId: string,
  override: "available" | "unavailable" | null,
): Promise<void> {
  if (!db) return;
  await setDoc(
    doc(db, "menuConfig", menuId),
    { manualOverride: override, updatedAt: serverTimestamp() },
    { merge: true },
  );
  recordAuditLog({
    action: "inventory.override_changed",
    actor: {
      uid: auth?.currentUser?.uid,
      email: auth?.currentUser?.email ?? undefined,
      type: "admin",
    },
    targetId: menuId,
    summary: `Menu availability for "${menuId}" set to ${override ?? "auto"}`,
    metadata: { menuId, override },
  }).catch(() => {});
}

/** Zeroes one item's running ordered-quantity counter. Manual admin action only. */
export async function resetMenuItemOrderedQty(menuId: string): Promise<void> {
  if (!db) return;
  await setDoc(
    doc(db, "menuConfig", menuId),
    { orderedQty: 0, updatedAt: serverTimestamp() },
    { merge: true },
  );
  recordAuditLog({
    action: "inventory.reset",
    actor: {
      uid: auth?.currentUser?.uid,
      email: auth?.currentUser?.email ?? undefined,
      type: "admin",
    },
    targetId: menuId,
    summary: `Ordered quantity reset to 0 for "${menuId}"`,
    metadata: { menuId },
  }).catch(() => {});
}

/** Zeroes every listed item's counter in one batch. Manual admin action only. */
export async function resetAllMenuItemOrderedQty(menuIds: string[]): Promise<void> {
  if (!db) return;
  const batch = writeBatch(db);
  for (const menuId of menuIds) {
    batch.set(
      doc(db, "menuConfig", menuId),
      { orderedQty: 0, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
  await batch.commit();
  recordAuditLog({
    action: "inventory.reset",
    actor: {
      uid: auth?.currentUser?.uid,
      email: auth?.currentUser?.email ?? undefined,
      type: "admin",
    },
    targetId: "all_items",
    summary: `Ordered quantity reset to 0 for ${menuIds.length} menu items`,
    metadata: { menuIds },
  }).catch(() => {});
}

/* ── Admin access diagnostic ───────────────────────────────────────────── */

export interface AdminAccessReport {
  signInEmail: string | null;
  signInUid: string | null;
  tokenEmail: string | null;
  tokenEmailVerified: boolean | null;
  /** true = doc exists; false = doc missing; null = read was itself denied */
  adminDocExists: boolean | null;
  /** true = token refresh succeeded before the probe; false = refresh failed */
  tokenRefreshed: boolean;
  nextOrderId: number;
  collectionReadWorks: boolean;
  ordersFound: number;
  ordersReadable: number;
  ordersDenied: string[]; // RK ids that failed an individual read
  /** "ok" = the live update rule permits a status change.
   *  "denied" = the write was refused with permission-denied → update rule is stale.
   *  "error" = the probe write failed for a non-permission reason (check the console log).
   *  null = couldn't probe (no orders were readable). */
  updateProbeWorks: "ok" | "denied" | "error" | null;
}

/**
 * One-click check that tells an admin *why* they can / can't see or update orders.
 * A full `collection(db, "orders")` read only succeeds if EVERY order passes the
 * read rule; if even one fails, the whole feed drops with permission-denied. This
 * separates the causes:
 *  - tokenEmail vs signInEmail mismatch  → wrong /admins doc key
 *  - adminDocExists false               → not admin at all
 *  - per-order reads denied             → rules in the console are stale
 *  - updateProbeWorks false             → the update rule in the console has no
 *    admin branch (re-publish firestore.rules.console-safe)
 */
export async function checkAdminAccess(email?: string | null): Promise<AdminAccessReport> {
  if (!db || !auth) throw new Error("Firebase not configured");

  const report: AdminAccessReport = {
    signInEmail: email ?? auth.currentUser?.email ?? null,
    signInUid: auth.currentUser?.uid ?? null,
    tokenEmail: null,
    tokenEmailVerified: null,
    adminDocExists: null,
    tokenRefreshed: false,
    nextOrderId: 0,
    collectionReadWorks: false,
    ordersFound: 0,
    ordersReadable: 0,
    ordersDenied: [],
    updateProbeWorks: null,
  };

  const current = auth.currentUser;
  if (current) {
    // Force-refresh the ID token so Firestore sees a fresh credential.
    // A stale token (>1 hour) causes permission-denied even when rules are correct.
    try {
      await getIdToken(current, /* forceRefresh */ true);
      report.tokenRefreshed = true;
    } catch (e) {
      console.warn("[checkAdminAccess] token refresh failed:", e);
    }
    try {
      const t = await getIdTokenResult(current);
      report.tokenEmail = (t.claims.email as string | undefined) ?? null;
      report.tokenEmailVerified =
        typeof t.claims.email_verified === "boolean" ? t.claims.email_verified : null;
    } catch { /* token fetch failed — phone-only or transient */ }
  }

  if (report.signInUid) {
    try {
      // null = this try block never ran; false = doc missing; true = doc exists.
      report.adminDocExists = (await getDoc(doc(db, "admins", report.signInUid))).exists();
    } catch (e) {
      // Keep null to signal "read was denied" (not the same as doc missing).
      console.warn("[checkAdminAccess] admins doc read denied:", e);
    }
  }

  try {
    const counter = await getDoc(doc(db, "meta", "counters"));
    report.nextOrderId = (counter.data()?.nextOrder as number | undefined) ?? 1;
  } catch { /* counter unreadable */ }

  // Exact-operation check: what the dashboard actually does.
  try {
    const qs = await getDocs(collection(db, "orders"));
    report.collectionReadWorks = true;
    report.ordersFound = qs.size;
    report.ordersReadable = qs.size;

    // Probe the UPDATE rule as an admin: pick the first order NOT owned by this
    // account and rewrite it with identical values. The owner clause can't pass
    // (not ours), so this only succeeds if the console's update rule lets admins
    // through. False positives here (stale status) are enough to flag the problem.
    const mine = report.signInUid ?? "__none__";
    // Prefer a doc NOT owned by this account so we're sure the admin branch fires
    // (owner branch would pass even without admin rights).
    const probeDoc = qs.docs.find((d) => d.data().customerId !== mine) ?? null;
    if (probeDoc) {
      try {
        // Mirror exactly what updateOrderStatus writes so the probe is a true replica.
        await updateDoc(doc(db, "orders", probeDoc.id), {
          status: probeDoc.data().status,
          statusHistory: probeDoc.data().statusHistory,
          updatedAt: serverTimestamp(),
        });
        report.updateProbeWorks = "ok";
      } catch (err) {
        // Only a real permission-denied means the update rule is stale. Any other
        // error (bad data shape, bad timestamp, etc.) is a different problem and
        // must not masquerade as a rules outcome.
        const code = (err as { code?: string }).code ?? "";
        report.updateProbeWorks = code === "permission-denied" ? "denied" : "error";
        if (code !== "permission-denied") console.error("[probe] non-permission update error:", err);
      }
    }
    // If every order is owned by the admin themselves, skip the probe rather than
    // get a false-positive via owner rights.
    if (!probeDoc && qs.size > 0) {
      console.info("[checkAdminAccess] all orders belong to admin — update probe skipped (result stays null).");
    }
  } catch {
    // Collection read denied — now find which RK ids fail one at a time
    // (a per-order filtered query only needs THAT doc to pass).
    for (let i = 1; i <= report.nextOrderId - 1; i++) {
      const rk = `RK-${String(i).padStart(5, "0")}`;
      const qo = query(collection(db, "orders"), where("orderId", "==", rk));
      try {
        const r = await getDocs(qo);
        if (r.size > 0) {
          report.ordersFound++;
          report.ordersReadable++;
        }
      } catch {
        report.ordersDenied.push(rk);
      }
    }
  }

  return report;
}

