"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { updateOrderStatus, checkAdminAccess, setAdmin, updateDeliveryMeta, type AdminAccessReport } from "@/lib/db";
import { formatINR } from "@/lib/menu";
import { waLinkToCustomer } from "@/lib/whatsapp";
import { launchPorterAppDeepLink, buildPorterClipboardData } from "@/lib/porterDeepLink";
import { useAdminAlerts } from "@/lib/admin-alerts-context";
import { subscribeRecentAuditLogs } from "@/lib/auditLogger";
import type { Order, OrderStatus, AuditLogEntry } from "@/types";
import { ORDER_STATUSES } from "@/types";

const STATUS_COLORS: Record<OrderStatus, string> = {
  Confirmed: "bg-ok/15 text-ok border-ok/30",
  Preparing: "bg-chili/10 text-chilidark border-chili/30",
  "Out for Delivery": "bg-greenburn/10 text-greenburn border-greenburn/30",
  "Ready for Pickup": "bg-turmeric/15 text-turmericdark border-turmeric/30",
  Delivered: "bg-ink/10 text-ink border-ink/20",
  Cancelled: "bg-chili/10 text-chili border-chili/30",
};

// Which slice of orders the dashboard shows. Defaults to "active" so completed
// and cancelled orders stay out of the kitchen's way unless asked for.
type OrderFilter = "active" | "delivered" | "cancelled" | "all";
const FILTER_KEY = "rakus-kitchen-admin-filter-v1";
const FILTERS: OrderFilter[] = ["active", "delivered", "cancelled", "all"];
const FILTER_LABELS: Record<OrderFilter, string> = {
  active: "Active",
  delivered: "Delivered",
  cancelled: "Cancelled",
  all: "All",
};

export default function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { alerts, orders, orderError, refreshOrders } = useAdminAlerts();
  const [access, setAccess] = useState<AdminAccessReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [showAuditLogs, setShowAuditLogs] = useState(true);

  // Subscribe to recent audit logs when Tools panel is open
  useEffect(() => {
    if (!showTools) return;
    const unsub = subscribeRecentAuditLogs(
      (logs) => setAuditLogs(logs),
      35,
      (err) => console.warn("[AuditLogs] Subscription failed:", err),
    );
    return () => unsub();
  }, [showTools]);

  // Order alert modal & acceptance state
  const [activeAlertIndex, setActiveAlertIndex] = useState(0);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);

  // Clamp index to available queue
  const safeAlertIndex = Math.min(activeAlertIndex, Math.max(0, alerts.queue.length - 1));
  const currentAlertOrder = alerts.queue[safeAlertIndex] as Order | undefined;

  const handleAcceptOrder = async (orderToAccept: Order) => {
    setAcceptingOrderId(orderToAccept.id);
    try {
      await updateOrderStatus(orderToAccept.id, "Preparing", user?.email ?? undefined);
      alerts.acknowledgeOrder(orderToAccept.id);
    } catch (err) {
      alert(`Could not accept order ${orderToAccept.orderId}: ${(err as Error).message}`);
    } finally {
      setAcceptingOrderId(null);
    }
  };

  const handleAcceptAllAlerts = async () => {
    setAcceptingOrderId("all");
    try {
      for (const o of alerts.queue) {
        await updateOrderStatus(o.id, "Preparing", user?.email ?? undefined);
      }
      alerts.acknowledge();
    } catch (err) {
      alert(`Could not accept all orders: ${(err as Error).message}`);
    } finally {
      setAcceptingOrderId(null);
    }
  };

  // Search: case-insensitive substring on orderId, customerName, or phone digits.
  const [search, setSearch] = useState("");

  // Order filter — remembered per device. Hydrated after mount (not in the
  // useState initializer) so server and first client render agree.
  const [filter, setFilter] = useState<OrderFilter>("active");
  const [filterHydrated, setFilterHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FILTER_KEY) as OrderFilter | null;
      if (saved && FILTERS.includes(saved)) setFilter(saved);
    } catch { /* storage unavailable — default to active */ }
    setFilterHydrated(true);
  }, []);
  useEffect(() => {
    if (!filterHydrated) return;
    try {
      window.localStorage.setItem(FILTER_KEY, filter);
    } catch { /* private mode — filter just won't persist */ }
  }, [filter, filterHydrated]);

  const reloadOrders = () => {
    refreshOrders();
  };

  const runAccessCheck = async () => {
    setChecking(true);
    try {
      setAccess(await checkAdminAccess(user?.email));
    } finally {
      setChecking(false);
    }
  };

  const bootstrapAdmin = async () => {
    if (!user?.uid) return;
    setChecking(true);
    try {
      await setAdmin(user.uid, true);
      // Re-run the full check so every row refreshes.
      setAccess(await checkAdminAccess(user?.email));
    } catch (e) {
      alert(`Failed to create admin doc: ${(e as Error).message}`);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login?next=%2Fadmin");
  }, [loading, user, router]);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-12 text-center text-soft">Loading…</div>;

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="text-5xl" aria-hidden>🔒</span>
        <h1 className="section-title mt-4">Admins only</h1>
        <p className="mt-2 text-sm text-soft">
          You&apos;re signed in as <span className="font-semibold text-ink">{user.phoneNumber ?? user.email ?? user.uid}</span> ({user.uid}),
          but this account isn&apos;t on the admin list. An existing admin needs to add it under{" "}
          <code className="rounded bg-cream px-1.5 py-0.5 text-xs">/admins/&lt;your-uid&gt;</code> in Firestore.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/orders" className="btn btn-ghost px-4 py-2 text-xs">My orders</Link>
          <button onClick={() => { signOut(auth!); router.push("/"); }} className="btn btn-ghost px-4 py-2 text-xs">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const counts = (orders ?? []).reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  // Action Priority ranking: Confirmed (1) -> Preparing (2) -> Out for Delivery / Ready for Pickup (3)
  const STATUS_PRIORITY: Record<string, number> = {
    Confirmed: 1,
    Preparing: 2,
    "Out for Delivery": 3,
    "Ready for Pickup": 3,
  };

  // Active orders: Action priority first, then FIFO (Oldest created order first)
  const active = (orders ?? [])
    .filter((o) => o.status !== "Delivered" && o.status !== "Cancelled")
    .sort((a, b) => {
      const prioA = STATUS_PRIORITY[a.status] ?? 99;
      const prioB = STATUS_PRIORITY[b.status] ?? 99;
      if (prioA !== prioB) return prioA - prioB;
      return a.createdAt - b.createdAt; // FIFO within same priority group
    });

  // Archived orders: Newest completed/cancelled first
  const archivedOrders = (orders ?? [])
    .filter((o) => o.status === "Delivered" || o.status === "Cancelled")
    .sort((a, b) => b.createdAt - a.createdAt);

  // Case-insensitive substring search on order id, customer name, or phone
  // digits — stacks on top of whatever filter tab is active.
  const q = search.trim().toLowerCase();
  const matchesSearch = (o: Order) => {
    if (!q) return true;
    if (o.orderId.toLowerCase().includes(q)) return true;
    if (o.customerName.toLowerCase().includes(q)) return true;
    const digits = q.replace(/\D/g, "");
    if (digits && o.phone.replace(/\D/g, "").includes(digits)) return true;
    return false;
  };

  const filterCounts: Record<OrderFilter, number> = {
    active: active.length,
    delivered: counts.Delivered ?? 0,
    cancelled: counts.Cancelled ?? 0,
    all: (orders ?? []).length,
  };

  // The "all" view renders archived orders separately in a collapsed group,
  // so its main list is just the active ones.
  const visibleOrders = (
    filter === "delivered"
      ? archivedOrders.filter((o) => o.status === "Delivered")
      : filter === "cancelled"
        ? archivedOrders.filter((o) => o.status === "Cancelled")
        : active
  ).filter(matchesSearch);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Kitchen dashboard</h1>
          <p className="text-sm text-soft">Orders update live as customers place them.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={reloadOrders} className="btn btn-ghost px-4 py-2 text-xs">
            ⟳ Refresh orders
          </button>
          <Link href="/admin/inventory" className="btn btn-ghost px-4 py-2 text-xs">
            📊 Item Sales & Limits
          </Link>
          {/* Access check moved off the main flow — it's a debug lifeline that
              only matters when orders are missing. */}
          <button
            onClick={() => setShowTools((v) => !v)}
            className="btn btn-ghost px-3 py-2 text-xs"
            aria-expanded={showTools}
            aria-controls="admin-tools-panel"
            title="Admin tools"
          >
            ⋯ Tools
          </button>
          <button onClick={() => { signOut(auth!); router.push("/"); }} className="btn btn-ghost px-4 py-2 text-xs">
            Sign out
          </button>
        </div>
      </header>

      {/* ── High-Priority Floating Incoming Order Modal (Zomato/Swiggy style) ── */}
      {alerts.queue.length > 0 && currentAlertOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inkdark/80 p-3 sm:p-4 backdrop-blur-sm animate-fade-in">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="alert-modal-title"
            className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border-4 border-chili bg-paper shadow-2xl animate-scale-up"
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-chili/10 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="text-xl animate-bounce">🔔</span>
                <div>
                  <h2 id="alert-modal-title" className="font-display text-base font-extrabold uppercase tracking-wide text-chili">
                    New Order Incoming!
                  </h2>
                  {alerts.queue.length > 1 && (
                    <p className="text-xs font-semibold text-soft">
                      Order {safeAlertIndex + 1} of {alerts.queue.length} in queue
                    </p>
                  )}
                </div>
              </div>

              {/* Stop Sound / Tone Control */}
              <div className="flex items-center gap-2">
                {alerts.isRinging ? (
                  <button
                    type="button"
                    onClick={alerts.stopAlertTone}
                    className="flex items-center gap-1.5 rounded-full border border-chili/40 bg-chili px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-chilidark transition active:scale-95 animate-pulse"
                    title="Silences the ringing alert tone immediately"
                  >
                    <span>🔇 Stop Alert Tone</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1 rounded-full border border-line bg-cream px-3 py-1 text-xs font-medium text-soft">
                    <span>🔈</span> Tone stopped
                  </span>
                )}
              </div>
            </div>

            {/* Modal Body: Active Order Details */}
            <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4 space-y-3.5 text-sm">
              {/* Order Meta Header */}
              <div className="flex items-start justify-between gap-3 border-b border-line/60 pb-3">
                <div>
                  <p className="font-display text-2xl font-black text-ink">
                    {currentAlertOrder.orderId}
                  </p>
                  <p className="text-xs text-soft">
                    {currentAlertOrder.mealSlot} · {currentAlertOrder.mealDate}
                  </p>
                </div>
                <div className="text-right">
                  <span className="chip border border-ok/40 bg-ok/10 text-ok font-bold">
                    {currentAlertOrder.status}
                  </span>
                  <p className="mt-1 font-display text-lg font-bold text-ink">
                    {formatINR(currentAlertOrder.grandTotal)}
                  </p>
                </div>
              </div>

              {/* Customer & Fulfillment Info */}
              <div className="rounded-2xl border border-line bg-cream/40 p-3 text-xs space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-sm text-ink">{currentAlertOrder.customerName}</span>
                  <a
                    href={`tel:${currentAlertOrder.phone.replace(/[^\d+]/g, "")}`}
                    className="font-bold text-chilidark hover:underline flex items-center gap-1"
                  >
                    📞 {currentAlertOrder.phone}
                  </a>
                </div>

                {/* Fulfillment Type */}
                {currentAlertOrder.fulfillmentType === "pickup" ? (
                  <div className="flex items-center gap-1.5 text-ok font-semibold pt-1">
                    <span>🛍️</span>
                    <span>Customer will self-pickup from the kitchen</span>
                  </div>
                ) : (
                  <div className="text-soft pt-1">
                    <span className="font-semibold text-ink">🛵 Delivery to: </span>
                    {currentAlertOrder.addressComponents?.displayAddress || currentAlertOrder.deliveryAddress}
                  </div>
                )}

                {currentAlertOrder.notes && (
                  <div className="rounded-lg bg-turmeric/10 border border-turmeric/30 p-2 text-xs text-turmericdark italic">
                    <strong>Note:</strong> {currentAlertOrder.notes}
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="rounded-2xl border border-line bg-paper p-3 text-xs">
                <p className="mb-2 font-bold uppercase tracking-wider text-soft text-[11px]">
                  Order Items ({currentAlertOrder.items.reduce((s, i) => s + i.qty, 0)} items)
                </p>
                <ul className="divide-y divide-line/40">
                  {currentAlertOrder.items.map((it, idx) => (
                    <li key={`${it.menuId}-${idx}`} className="flex items-center justify-between py-1.5">
                      <span className="font-medium text-ink">
                        {it.name}{it.variant ? ` (${it.variant})` : ""}{" "}
                        <span className="font-bold text-chili">×{it.qty}</span>
                      </span>
                      <span className="font-semibold text-soft">{formatINR(it.lineTotal)}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between pt-1.5 text-soft">
                    <span>Packaging fee</span>
                    <span>{formatINR(currentAlertOrder.packagingFee)}</span>
                  </li>
                  <li className="flex items-center justify-between pt-1.5 text-sm font-black text-ink">
                    <span>Grand Total</span>
                    <span className="text-chilidark font-display text-base">{formatINR(currentAlertOrder.grandTotal)}</span>
                  </li>
                </ul>
              </div>

              {/* Multi-Order Carousel Selector if queue > 1 */}
              {alerts.queue.length > 1 && (
                <div className="flex items-center justify-between gap-2 border-t border-line/50 pt-2 text-xs">
                  <span className="text-soft">Navigate orders:</span>
                  <div className="flex items-center gap-1.5">
                    {alerts.queue.map((qOrder, idx) => (
                      <button
                        key={qOrder.id}
                        type="button"
                        onClick={() => setActiveAlertIndex(idx)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          idx === safeAlertIndex
                            ? "bg-chili text-white shadow-sm"
                            : "border border-line bg-paper text-soft hover:text-ink"
                        }`}
                      >
                        #{qOrder.orderId}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-line bg-paper px-5 py-3.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alerts.acknowledgeOrder(currentAlertOrder.id)}
                  className="btn btn-ghost px-3 py-2 text-xs text-soft hover:text-ink"
                  title="Dismiss alert without changing order status"
                >
                  Dismiss
                </button>
                {alerts.queue.length > 1 && (
                  <button
                    type="button"
                    disabled={acceptingOrderId === "all"}
                    onClick={handleAcceptAllAlerts}
                    className="btn btn-ghost px-3 py-2 text-xs font-semibold text-chili hover:bg-chili/10"
                  >
                    {acceptingOrderId === "all" ? "Accepting all…" : `Accept all (${alerts.queue.length})`}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {alerts.isRinging && (
                  <button
                    type="button"
                    onClick={alerts.stopAlertTone}
                    className="btn btn-ghost px-3 py-2 text-xs font-bold text-chili"
                  >
                    🔇 Stop Sound
                  </button>
                )}
                <button
                  type="button"
                  disabled={acceptingOrderId === currentAlertOrder.id}
                  onClick={() => handleAcceptOrder(currentAlertOrder)}
                  className="btn btn-chili flex-1 sm:flex-initial px-6 py-2.5 text-sm font-extrabold shadow-md hover:shadow-lg transition"
                >
                  {acceptingOrderId === currentAlertOrder.id
                    ? "Accepting…"
                    : `✅ Accept Order ${currentAlertOrder.orderId}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky top banner when new orders are waiting to be accepted */}
      {alerts.queue.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-chili bg-chili/10 p-4 sm:p-5 animate-pulse-alert"
        >
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-chili flex items-center gap-1.5">
              <span>🔔</span>
              <span>{alerts.queue.length === 1 ? "1 new order waiting for acceptance" : `${alerts.queue.length} new orders waiting for acceptance`}</span>
            </p>
            <p className="mt-1 text-sm text-ink font-semibold">
              {alerts.queue.map((o) => `${o.orderId} (${o.customerName})`).join(", ")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {alerts.isRinging && (
              <button
                type="button"
                onClick={alerts.stopAlertTone}
                className="btn btn-ghost px-3 py-2 text-xs font-bold text-chili"
              >
                🔇 Stop Sound
              </button>
            )}
            <button
              type="button"
              onClick={handleAcceptAllAlerts}
              className="btn btn-chili px-4 py-2 text-sm font-bold"
            >
              ✅ Accept All & Start Preparing
            </button>
          </div>
        </div>
      )}

      {/* Arm banner — one tap unlocks audio. Hides once armed. */}
      {!alerts.armed && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-turmeric bg-turmeric/10 px-4 py-3 text-sm">
          <p className="min-w-0 text-ink">
            <span className="font-bold">🔔 Enable order alerts</span>
            <span className="block text-xs text-soft">
              Tap once so the kitchen hears new orders. This device will play the order chime and vibrate when a new order arrives.
            </span>
          </p>
          <button
            type="button"
            onClick={() => { void alerts.arm(); }}
            className="btn btn-chili shrink-0 px-4 py-2 text-xs font-bold shadow-md hover:shadow-lg transition"
          >
            Enable alerts
          </button>
        </div>
      )}

      {/* Loading snag — the listener retries itself, but give the admin a manual nudge. */}
      {orderError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-chili/30 bg-chili/5 px-4 py-3 text-sm">
          <p className="text-chili">
            Orders hit a snag loading — retrying automatically. If this persists, check{" "}
            <span className="font-semibold">Verify admin access</span> below.
          </p>
          <button onClick={reloadOrders} className="btn btn-ghost px-3 py-1.5 text-xs">
            Retry now
          </button>
        </div>
      )}

      {/* Admin tools panel — debug lifeline, hidden by default behind the ⋯ button. */}
      {showTools && (
        <div id="admin-tools-panel" className="card mb-6 p-4 text-sm">
          <button
            onClick={runAccessCheck}
            disabled={checking}
            className="btn btn-ghost mb-3 px-3 py-1.5 text-xs"
          >
            {checking ? "Checking…" : "Run access check"}
          </button>
          {access && (
            <ul className="space-y-1 font-mono text-xs leading-relaxed">
              <AccessRow label="Signed in as" value={access.signInEmail ?? "—"} ok={!!access.signInEmail} />
              <AccessRow label="UID" value={access.signInUid ?? "— (missing!)"} ok={!!access.signInUid} />
              <AccessRow
                label="Token refreshed"
                value={access.tokenRefreshed ? "yes" : "failed (stale token may cause DENIED)"}
                ok={access.tokenRefreshed}
              />
              <AccessRow
                label="Email verified"
                value={String(access.tokenEmailVerified ?? "—")}
                ok={access.tokenEmailVerified === true}
              />
              <AccessRow
                label="/admins/{uid} doc exists"
                value={
                  access.adminDocExists === null
                    ? "read denied (sign in / UID mismatch)"
                    : String(access.adminDocExists)
                }
                ok={access.adminDocExists === true}
              />
              <AccessRow
                label="Full orders read"
                value={access.collectionReadWorks ? `OK — ${access.ordersReadable} orders` : "permission-denied"}
                ok={access.collectionReadWorks}
              />
              <AccessRow
                label="Admin update (status change)"
                value={
                  access.updateProbeWorks == null
                    ? "— (no non-owned orders to probe)"
                    : access.updateProbeWorks === "ok"
                      ? "OK — allowed"
                      : access.updateProbeWorks === "denied"
                        ? "DENIED — /admins doc missing or update rule stale"
                        : "ERROR — probe failed (not permissions, see console)"
                }
                ok={access.updateProbeWorks === "ok"}
              />
              {!access.collectionReadWorks && (
                <>
                  <AccessRow
                    label="Orders readable"
                    value={`${access.ordersReadable} / ${access.ordersFound}`}
                    ok={access.ordersReadable === access.ordersFound}
                  />
                  {access.ordersDenied.length > 0 && (
                    <AccessRow
                      label="Denied (need admin)"
                      value={access.ordersDenied.join(", ")}
                      ok={false}
                    />
                  )}
                </>
              )}
            </ul>
          )}
          {access && !access.adminDocExists && access.signInUid && (
            <div className="mt-4 rounded-xl border border-chili/30 bg-chili/5 p-3">
              <p className="mb-2 text-xs font-semibold text-chili">
                ⚠️ No <code className="rounded bg-cream px-1">/admins/{access.signInUid}</code> document found.
                This is why status updates are denied — <code>isAdmin()</code> returns false.
              </p>
              <button
                onClick={bootstrapAdmin}
                disabled={checking}
                className="btn btn-chili px-4 py-2 text-xs"
              >
                {checking ? "Creating…" : "Bootstrap admin doc (create it now)"}
              </button>
            </div>
          )}
          <p className="mt-3 text-xs text-soft">
            Permissions come from Firestore security rules. Admin is keyed by UID: the
            /admins doc id must be your UID (not email). If the doc exists but the update
            probe says DENIED, re-publish{" "}
            <code className="rounded bg-cream px-1.5 py-0.5">firestore.rules.console-safe</code>.
          </p>

          {/* ── Platform Audit Log & Activity Trail ── */}
          <div className="mt-6 border-t border-line/60 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-display font-bold text-base flex items-center gap-2">
                  <span>📜 Platform Activity & Audit Trail</span>
                  <span className="rounded-full bg-ok/10 border border-ok/30 px-2 py-0.5 text-[11px] font-medium text-ok">
                    🛡️ 30-Day Retention Policy
                  </span>
                </h3>
                <p className="text-xs text-soft">
                  Real-time record of all status updates, inventory changes, and courier bookings. Auto-expires to prevent database bloat.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditLogs((v) => !v)}
                className="btn btn-ghost px-3 py-1.5 text-xs"
              >
                {showAuditLogs ? "Hide logs" : `Show logs (${auditLogs.length})`}
              </button>
            </div>

            {showAuditLogs && (
              <div className="mt-3 space-y-2">
                <div className="rounded-xl border border-line bg-paper/60 p-2.5 text-xs text-soft">
                  <span>
                    💡 <strong>Retention guarantee:</strong> Every log carries an <code>expiresAt</code> TTL timestamp to guarantee it never accumulates as an unbounded database burden.
                  </span>
                </div>
                {auditLogs.length === 0 ? (
                  <p className="py-4 text-center text-xs text-soft italic">No audit records logged yet.</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto rounded-xl border border-line bg-paper divide-y divide-line/40">
                    {auditLogs.map((log, idx) => (
                      <div key={log.id ?? idx} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-ink">{log.summary}</span>
                            <span className="rounded bg-cream px-1.5 py-0.5 text-[10px] font-mono text-soft">
                              {log.action}
                            </span>
                          </div>
                          <p className="text-soft text-[11px]">
                            Actor: <span className="font-medium text-ink">{log.actor.email || log.actor.name || log.actor.uid || "System"}</span> ({log.actor.type})
                            {log.targetId && ` · Target: ${log.targetId}`}
                          </p>
                        </div>
                        <span className="shrink-0 text-soft text-[11px] font-mono">
                          {new Date(log.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) +
                            ", " +
                            new Date(log.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search — counts on the filter tabs already summarize state, so the
          five status tiles are gone. This narrows within the active tab. */}
      {orders !== null && orders.length > 0 && (
        <div className="mb-4 relative">
          <input
            type="search"
            inputMode="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order ID, name or phone…"
            className="field py-2.5 pr-10"
            aria-label="Search orders"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 text-soft hover:text-ink"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Active orders first */}
      {orders === null && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-40 animate-pulse bg-cream/60 p-5" />
          ))}
        </div>
      )}

      {orders?.length === 0 && (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <span className="text-4xl" aria-hidden>🕐</span>
          <p className="font-semibold">No orders yet</p>
          <p className="text-sm text-soft">New orders will appear here instantly.</p>
        </div>
      )}

      {orders !== null && orders.length > 0 && (
        <>
          {/* Filter tabs — Active by default so finished orders stay out of the way. */}
          <div
            role="tablist"
            aria-label="Filter orders"
            className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
          >
            {FILTERS.map((f) => {
              const selected = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  id={`filter-tab-${f}`}
                  aria-selected={selected}
                  aria-controls="orders-panel"
                  onClick={() => setFilter(f)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    selected
                      ? "border-chili bg-chili text-cream"
                      : "border-line bg-paper text-ink hover:border-soft"
                  }`}
                >
                  {FILTER_LABELS[f]}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      selected ? "bg-cream/20" : "bg-cream"
                    }`}
                  >
                    {filterCounts[f]}
                  </span>
                </button>
              );
            })}
          </div>

          <div role="tabpanel" id="orders-panel" aria-labelledby={`filter-tab-${filter}`} className="space-y-4">
            {visibleOrders.length === 0 && filter !== "all" && (
              <div className="card p-8 text-center text-sm text-soft">{EMPTY_MESSAGES[filter]}</div>
            )}

            {visibleOrders.map((order) => (
              <AdminOrderCard key={order.id} order={order} archived={filter !== "active" && filter !== "all"} />
            ))}

            {/* In the All view, finished orders sit in a collapsed group below active ones. */}
            {filter === "all" && archivedOrders.filter(matchesSearch).length > 0 && (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-line bg-cream/40 px-4 py-3 text-sm font-semibold text-ink">
                  <span>Delivered &amp; Cancelled ({archivedOrders.filter(matchesSearch).length})</span>
                  <span className="text-xs text-soft group-open:hidden">Show</span>
                  <span className="hidden text-xs text-soft group-open:inline">Hide</span>
                </summary>
                <div className="mt-4 space-y-4">
                  {archivedOrders.filter(matchesSearch).map((order) => (
                    <AdminOrderCard key={order.id} order={order} archived />
                  ))}
                </div>
              </details>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const EMPTY_MESSAGES: Record<Exclude<OrderFilter, "all">, string> = {
  active: "No active orders right now. New ones will appear here.",
  delivered: "No delivered orders yet.",
  cancelled: "No cancelled orders.",
};

/**
 * Copy-paste helper for Porter's booking form. Renders one row per field
 * Porter asks for (drop address, building, receiver's name, phone) plus a
 * Copy All button, so the admin never has to retype what's already on the
 * order. Sits inside the delivery-action column and only shows when the
 * order is still bookable (its parent's `canBookDelivery` gate).
 */
function PorterCopyHelper({
  order,
  copied,
  setCopied,
}: {
  order: Order;
  copied: Record<string, boolean>;
  setCopied: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
}) {
  const data = buildPorterClipboardData(order);
  const rows: { key: string; label: string; value: string }[] = [
    { key: "drop", label: "Drop Address", value: data.dropAddress },
    { key: "building", label: "Building", value: data.buildingDetails },
    { key: "name", label: "Name", value: data.receiverName },
    { key: "phone", label: "Phone", value: data.receiverPhone },
  ];

  return (
    <div className="mt-1 rounded-xl border border-line bg-cream/30 p-2 text-[11px]">
      <p className="mb-1.5 px-1 font-bold uppercase tracking-wider text-soft">📋 Porter details</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-1.5 rounded-lg bg-paper px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-soft">{row.label}</p>
              <p className="truncate text-ink" title={row.value}>{row.value}</p>
            </div>
            <button
              type="button"
              onClick={() => copyWithFeedback(row.value, row.key, setCopied)}
              className="shrink-0 rounded-md border border-line bg-cream px-2 py-1 text-[10px] font-bold text-ink transition hover:bg-turmeric/20"
              aria-label={`Copy ${row.label}`}
            >
              {copied[row.key] ? "✓ Copied" : "Copy"}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => copyWithFeedback(data.allDetails, "all", setCopied)}
        className="mt-1.5 w-full rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold text-paper transition hover:bg-ink/85"
      >
        {copied.all ? "✓ Copied all details" : "📋 Copy all details"}
      </button>
    </div>
  );
}

function AccessRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <li className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-soft">{label}:</span>
      {/* min-w-0 + break-all: long UIDs/emails are flex children, which default
          to min-width:auto and would otherwise force this row (and the whole
          card) wider than the viewport instead of wrapping. */}
      <span
        className={`min-w-0 break-all text-right ${ok ? "font-semibold text-ok" : "font-semibold text-chili"}`}
      >
        {ok ? "✓ " : "✗ "}
        {value}
      </span>
    </li>
  );
}

/**
 * Copy `text` to the clipboard and, on success, flip a per-key "copied" flag
 * back off after 1.5s so a button can show a brief "Copied!" state without
 * every button sharing one flag. Falls back to a prompt-based copy when the
 * browser blocks async clipboard access (private mode, some in-app WebViews).
 */
async function copyWithFeedback(
  text: string,
  key: string,
  setCopied: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void,
) {
  try {
    await navigator.clipboard.writeText(text);
    setCopied((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 1500);
  } catch (err) {
    console.warn("Clipboard write failed:", err);
    // Last-ditch fallback: show the text so the admin can long-press-copy.
    window.prompt("Clipboard blocked — copy this manually:", text);
  }
}

function AdminOrderCard({ order, archived = false }: { order: Order; archived?: boolean }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  // Per-field "just copied" flags so each row's button can show its own tick.
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  // ShadowFax fare calculator: separate from bookingBusy so fetching a quote
  // doesn't disable the other carriers' buttons.
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quote, setQuote] = useState<
    { fareEstimate: number; distanceKm?: number; etaMinutes?: number; mock?: boolean } | null
  >(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const time = new Date(order.createdAt).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });

  /** Change order status silently in Firestore (WhatsApp is sent via the explicit button below). */
  const changeStatus = async (status: OrderStatus) => {
    if (status === order.status) return;
    setBusy(true);
    try {
      await updateOrderStatus(order.id, status, user?.email ?? undefined);
    } catch (err) {
      console.error(err);
      const e = err as Error;
      const code = e.name === "FirebaseError" ? (err as { code?: string }).code ?? "" : "";
      alert(
        `Couldn't update the status.\n\n${e.message ?? "Unknown error"}${code ? `\n\n(code: ${code})` : ""}`,
      );
    } finally {
      setBusy(false);
    }
  };

  /**
   * Books a Borzo delivery ride (Automated 1-Click API).
   */
  const handleBookBorzo = async () => {
    const dropAddress = order.addressComponents
      ? `${order.addressComponents.doorAndBuilding}, ${order.addressComponents.displayAddress}${
          order.addressComponents.landmark ? ` (Landmark: ${order.addressComponents.landmark})` : ""
        }`
      : order.deliveryAddress;

    if (!confirm(
      `Book 1-click Borzo delivery for ${order.orderId}?\n\n` +
      `Customer: ${order.customerName}\n` +
      `Drop: ${dropAddress}`,
    )) return;

    setBookingBusy(true);
    try {
      const res = await fetch("/api/delivery/borzo", {
        method: "POST",
        // Borzo route is admin-gated — send the admin's ID token, same as the
        // Shadowfax handlers, or requireAdmin returns 401.
        headers: await authHeaders(),
        body: JSON.stringify({
          orderId: order.orderId,
          customerName: order.customerName,
          customerPhone: order.phone,
          dropAddress,
        }),
      });

      const data = (await res.json()) as {
        carrierId?: string;
        carrierOrderId?: string;
        fareEstimate?: number;
        trackingUrl?: string;
        mock?: boolean;
        error?: string;
      };

      if (!res.ok || data.error) throw new Error(data.error || `Borzo API error (${res.status})`);

      await updateDeliveryMeta(order.id, {
        carrierId: data.carrierId || "borzo",
        carrierOrderId: data.carrierOrderId,
        fareEstimate: data.fareEstimate,
        bookedAt: Date.now(),
        trackingUrl: data.trackingUrl,
      });

      await updateOrderStatus(order.id, "Out for Delivery", user?.email ?? undefined);
      // No implicit WhatsApp popup here — the standard per-status "Message
      // customer" button below sends the Out-for-Delivery message manually,
      // consistent with every other status (and avoids a surprise tab in mock mode).

      if (data.mock) {
        alert(
          `✅ Borzo Delivery Booked (MOCK MODE)\n\n` +
          `Order ID: ${data.carrierOrderId}\n` +
          `Fare Estimate: ₹${data.fareEstimate}\n\n` +
          `Set BORZO_API_KEY in .env.local for real Borzo bookings.`,
        );
      }
    } catch (err) {
      alert(`Borzo delivery booking failed: ${(err as Error).message}`);
    } finally {
      setBookingBusy(false);
    }
  };

  /** Build the drop address + coordinates once — reused by ShadowFax quote & booking. */
  const dropForShadowfax = () => ({
    dropAddress: order.addressComponents
      ? `${order.addressComponents.doorAndBuilding}, ${order.addressComponents.displayAddress}${
          order.addressComponents.landmark ? ` (Landmark: ${order.addressComponents.landmark})` : ""
        }`
      : order.deliveryAddress,
    dropLat: order.addressComponents?.lat,
    dropLng: order.addressComponents?.lng,
  });

  /** Attaches the admin's Firebase ID token to a request to the guarded routes. */
  const authHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth?.currentUser) {
      // Force-refresh so a >1h-old token doesn't get rejected as expired.
      const token = await auth.currentUser.getIdToken(/* forceRefresh */ true);
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  /** Fetches a ShadowFax fare estimate before booking (advisory — never gates booking). */
  const handleShadowfaxQuote = async () => {
    setQuoteBusy(true);
    setQuoteError(null);
    try {
      const res = await fetch("/api/delivery/shadowfax/quote", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(dropForShadowfax()),
      });
      const data = (await res.json()) as {
        fareEstimate?: number;
        distanceKm?: number;
        etaMinutes?: number;
        mock?: boolean;
        error?: string;
      };
      if (!res.ok || data.error || data.fareEstimate === undefined) {
        throw new Error(data.error || `Fare quote failed (${res.status})`);
      }
      setQuote({
        fareEstimate: data.fareEstimate,
        distanceKm: data.distanceKm,
        etaMinutes: data.etaMinutes,
        mock: data.mock,
      });
    } catch (err) {
      setQuoteError((err as Error).message);
    } finally {
      setQuoteBusy(false);
    }
  };

  /** Books a ShadowFax delivery ride (authenticated 1-click API). */
  const handleBookShadowfax = async () => {
    const drop = dropForShadowfax();

    if (!confirm(
      `Book ShadowFax delivery for ${order.orderId}?\n\n` +
      `Customer: ${order.customerName}\n` +
      `Drop: ${drop.dropAddress}` +
      (quote ? `\nEstimated fare: ₹${quote.fareEstimate}` : ""),
    )) return;

    setBookingBusy(true);
    try {
      const res = await fetch("/api/delivery/shadowfax", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          orderId: order.orderId,
          customerName: order.customerName,
          customerPhone: order.phone,
          ...drop,
        }),
      });

      const data = (await res.json()) as {
        carrierId?: string;
        carrierOrderId?: string;
        fareEstimate?: number;
        trackingUrl?: string;
        mock?: boolean;
        error?: string;
      };

      if (!res.ok || data.error) throw new Error(data.error || `ShadowFax API error (${res.status})`);

      await updateDeliveryMeta(order.id, {
        carrierId: data.carrierId || "shadowfax",
        carrierOrderId: data.carrierOrderId,
        fareEstimate: data.fareEstimate,
        bookedAt: Date.now(),
        trackingUrl: data.trackingUrl,
      });

      await updateOrderStatus(order.id, "Out for Delivery", user?.email ?? undefined);

      if (data.mock) {
        alert(
          `✅ ShadowFax Delivery Booked (MOCK MODE)\n\n` +
          `Order ID: ${data.carrierOrderId}\n` +
          `Fare Estimate: ₹${data.fareEstimate}\n\n` +
          `Set SHADOWFAX_API_KEY in .env.local for real ShadowFax bookings.`,
        );
      }
    } catch (err) {
      alert(`ShadowFax delivery booking failed: ${(err as Error).message}`);
    } finally {
      setBookingBusy(false);
    }
  };

  /** Show delivery options only when cooking is done or preparing, ride not yet booked,
   *  and the order is actually being delivered (self-pickup orders never need a carrier). */
  const canBookDelivery =
    (order.status === "Confirmed" || order.status === "Preparing") &&
    !order.deliveryMeta?.carrierOrderId &&
    order.fulfillmentType !== "pickup";

  return (
    <article className={`card overflow-hidden ${archived ? "opacity-75" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream/40 px-4 py-3 sm:px-5">
        <div>
          <p className="font-display font-bold">{order.orderId}</p>
          <p className="text-xs text-soft">{time}</p>
        </div>
        <span className={`chip border ${STATUS_COLORS[order.status]}`}>
          {order.status}
        </span>
      </header>

      {/* grid-cols-1 = minmax(0, 1fr): without an explicit track, the implicit
          column sizes to its widest child's min-content — the unwrapped
          (truncate) Porter address — and stretches the whole card past the
          phone's width, pushing button labels off-screen. */}
      <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-5 md:grid-cols-[1fr_auto]">
        {/* Order details */}
        <div className="min-w-0 space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold">{order.customerName}</span>
            <a href={`tel:${order.phone.replace(/[^\d+]/g, "")}`} className="text-chilidark hover:underline">
              {order.phone}
            </a>
          </div>
          <p className="text-soft">
            <span className="font-bold text-ink">{order.mealSlot}</span> · {order.mealDate}
          </p>

          {/* Fulfillment — pickup badge or delivery address */}
          {order.fulfillmentType === "pickup" ? (
            <div className="rounded-xl border border-ok/30 bg-ok/5 px-3 py-2.5 text-xs">
              <p className="font-semibold text-ok">🏠 Self-Pickup</p>
              <p className="mt-1 text-soft">Customer will collect from the kitchen</p>
            </div>
          ) : order.addressComponents ? (
            <div className="rounded-xl border border-line bg-paper p-3 text-xs">
              <p className="font-semibold text-ink">{order.addressComponents.doorAndBuilding}</p>
              <p className="mt-0.5 text-soft">{order.addressComponents.displayAddress}</p>
              {order.addressComponents.landmark && (
                <p className="mt-0.5 italic text-soft">Landmark: {order.addressComponents.landmark}</p>
              )}
              <a
                href={`https://maps.google.com/?q=${order.addressComponents.lat},${order.addressComponents.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-chilidark underline underline-offset-2 hover:text-ink"
              >
                📍 View on Google Maps ↗
              </a>
            </div>
          ) : (
            <p className="text-soft">📍 {order.deliveryAddress}</p>
          )}

          {order.notes && <p className="text-soft italic">Notes: {order.notes}</p>}

          <ul className="rounded-xl border border-line bg-paper px-3 py-2">
            {order.items.map((it) => (
              <li key={`${it.menuId}-${it.variant}-${it.qty}`} className="flex justify-between gap-3 py-0.5">
                {/* min-w-0: a flex child defaults to min-width:auto, so a long
                    item name would refuse to wrap and push the price (and the
                    whole card) wider than the screen instead. */}
                <span className="min-w-0">
                  {it.name}{it.variant ? ` (${it.variant})` : ""} <span className="text-soft">×{it.qty}</span>
                </span>
                <span className="shrink-0 font-semibold">{formatINR(it.lineTotal)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-line/60 pt-1 text-soft">
              <span>Packaging</span><span>{formatINR(order.packagingFee)}</span>
            </li>
            <li className="flex justify-between gap-3 font-bold">
              <span>Total</span><span>{formatINR(order.grandTotal)}</span>
            </li>
          </ul>

          {/* Delivery booking status badge */}
          {order.deliveryMeta?.carrierOrderId && (
            <div className="flex items-start gap-2 rounded-lg border border-ok/30 bg-ok/5 px-3 py-2 text-xs">
              <span className="shrink-0 text-ok">✓</span>
              {/* min-w-0: without it this flex child won't wrap and pushes the
                  card wider than the screen on a long tracking URL / carrier id. */}
              <span className="min-w-0 break-words">
                <span className="font-semibold text-ink">
                  {({ borzo: "Borzo", porter: "Porter", shadowfax: "ShadowFax" } as Record<string, string>)[
                    order.deliveryMeta.carrierId ?? ""
                  ] ?? "Delivery"}{" "}
                  booked
                </span>
                {" · "}Order: {order.deliveryMeta.carrierOrderId}
                {order.deliveryMeta.fareEstimate !== undefined && (
                  <span className="ml-1 text-soft">
                    · Delivery fee ₹{order.deliveryMeta.fareEstimate} (COD to driver)
                  </span>
                )}
                {order.deliveryMeta.trackingUrl && (
                  <a
                    href={order.deliveryMeta.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-chilidark underline"
                  >
                    Track rider ↗
                  </a>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex min-w-0 flex-col gap-2 md:w-52 md:items-stretch">
          {/* Dual Delivery Dispatch Buttons — Borzo API & Porter Deep Link */}
          {canBookDelivery && (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={handleBookBorzo}
                disabled={bookingBusy || busy}
                className="rounded-xl bg-turmeric px-4 py-2.5 text-xs font-bold text-inkdark shadow-sm transition hover:bg-turmeric/80 disabled:opacity-50"
                title="Automatically creates rider booking via Borzo Business API with pre-filled details"
              >
                {bookingBusy ? "Booking Borzo..." : "⚡ Book via Borzo (1-Click API)"}
              </button>
              <button
                onClick={() => launchPorterAppDeepLink(order)}
                disabled={bookingBusy || busy}
                className="rounded-xl border border-turmeric/60 bg-paper px-4 py-2 text-xs font-bold text-ink transition hover:bg-turmeric/10 disabled:opacity-50"
                title="Opens installed Porter App directly & copies address for 1-tap paste"
              >
                📱 Open Porter App (1-Tap Paste)
              </button>

              {/* ShadowFax — fare calculator (quote) + 1-click booking */}
              <div className="rounded-xl border border-greenburn/40 bg-greenburn/5 p-2">
                <button
                  onClick={handleShadowfaxQuote}
                  disabled={quoteBusy || bookingBusy || busy}
                  className="w-full rounded-lg border border-greenburn/50 bg-paper px-4 py-2 text-xs font-bold text-greenburn transition hover:bg-greenburn/10 disabled:opacity-50"
                  title="Fetches a ShadowFax delivery fare estimate before booking"
                >
                  {quoteBusy ? "Getting fare…" : "💰 Get ShadowFax fare"}
                </button>
                {quote && (
                  <p className="mt-1.5 px-1 text-[11px] text-ink">
                    📍{quote.distanceKm !== undefined ? ` ~${quote.distanceKm} km ·` : ""} est.{" "}
                    <span className="font-bold">₹{quote.fareEstimate}</span>
                    {quote.etaMinutes !== undefined ? ` · ~${quote.etaMinutes} min` : ""}
                    {quote.mock ? " (mock)" : ""}
                  </p>
                )}
                {quoteError && (
                  <p className="mt-1.5 px-1 text-[11px] text-chili">Couldn&apos;t fetch fare: {quoteError}</p>
                )}
                <button
                  onClick={handleBookShadowfax}
                  disabled={bookingBusy || busy}
                  className="mt-1.5 w-full rounded-lg bg-greenburn px-4 py-2.5 text-xs font-bold text-paper shadow-sm transition hover:bg-greenburn/85 disabled:opacity-50"
                  title="Books a rider via the ShadowFax partner API with pre-filled details"
                >
                  {bookingBusy ? "Booking ShadowFax…" : "⚡ Book via ShadowFax"}
                </button>
              </div>

              <PorterCopyHelper order={order} copied={copied} setCopied={setCopied} />
            </div>
          )}

          <label className="text-xs font-bold uppercase tracking-wider text-soft" htmlFor={`status-${order.id}`}>
            Update status
          </label>

          {/* Forward-only status dropdown & backward locks */}
          {order.status === "Delivered" || order.status === "Cancelled" ? (
            <div className="rounded-xl border border-line bg-cream/50 px-3 py-2 text-center text-xs font-semibold text-soft">
              🔒 Order {order.status} (Locked)
            </div>
          ) : (
            <select
              id={`status-${order.id}`}
              value={order.status}
              disabled={busy}
              onChange={(e) => changeStatus(e.target.value as OrderStatus)}
              className="field py-2.5 text-sm font-semibold"
            >
              {(() => {
                const pickupTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
                  Confirmed: ["Confirmed", "Preparing", "Cancelled"],
                  Preparing: ["Preparing", "Ready for Pickup", "Cancelled"],
                  "Ready for Pickup": ["Ready for Pickup", "Delivered", "Cancelled"],
                  Delivered: ["Delivered"],
                  Cancelled: ["Cancelled"],
                };
                const deliveryTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
                  Confirmed: ["Confirmed", "Preparing", "Cancelled"],
                  Preparing: ["Preparing", "Out for Delivery", "Cancelled"],
                  "Out for Delivery": ["Out for Delivery", "Delivered", "Cancelled"],
                  Delivered: ["Delivered"],
                  Cancelled: ["Cancelled"],
                };
                const transitions =
                  order.fulfillmentType === "pickup"
                    ? pickupTransitions[order.status] ?? ["Confirmed", "Preparing", "Ready for Pickup", "Delivered"]
                    : deliveryTransitions[order.status] ?? ORDER_STATUSES;

                return transitions.map((s) => (
                  <option key={s} value={s}>
                    {order.fulfillmentType === "pickup" && s === "Delivered" ? "Picked Up (Delivered)" : s}
                  </option>
                ));
              })()}
            </select>
          )}
          <a
            href={waLinkToCustomer(order, order.status)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-chili py-2 text-xs"
          >
            Message customer on WhatsApp
          </a>
          <span className="hidden text-[11px] text-soft md:block">
            Opens WhatsApp to {order.phone} — sent from your Raku&apos;s Kitchen account.
          </span>
          <div className="hidden text-[11px] text-soft md:block">
            {order.statusHistory.length > 1 ? (
              <div className="space-y-0.5">
                <span className="block">Flow: {order.statusHistory.map((h) => h.status).join(" → ")}</span>
                {order.statusHistory[order.statusHistory.length - 1]?.by && (
                  <span className="block text-[10px] text-soft/80">
                    Latest update by: {order.statusHistory[order.statusHistory.length - 1].by}
                  </span>
                )}
              </div>
            ) : (
              <span>Placed via online payment</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}