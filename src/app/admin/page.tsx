"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { subscribeAllOrders, updateOrderStatus, checkAdminAccess, setAdmin, type AdminAccessReport } from "@/lib/db";
import { formatINR } from "@/lib/menu";
import { buildOrderMessage } from "@/lib/whatsapp";
import type { Order, OrderStatus } from "@/types";
import { ORDER_STATUSES } from "@/types";

const STATUS_COLORS: Record<OrderStatus, string> = {
  "Order Received": "bg-turmeric/20 text-turmerick border-turmeric/40",
  Confirmed: "bg-ok/15 text-ok border-ok/30",
  Preparing: "bg-chili/10 text-chilidark border-chili/30",
  "Out for Delivery": "bg-greenburn/10 text-greenburn border-greenburn/30",
  Delivered: "bg-ink/10 text-ink border-ink/20",
  Cancelled: "bg-chili/10 text-chili border-chili/30",
};

export default function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [access, setAccess] = useState<AdminAccessReport | null>(null);
  const [checking, setChecking] = useState(false);

  // Tear down the listener and re-arm it (bumped from the Refresh/Retry buttons).
  const reloadOrders = () => {
    setOrders(null);
    setOrderError(null);
    setRefreshKey((k) => k + 1);
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

  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = subscribeAllOrders(
      (next) => {
        setOrderError(null); // a live snapshot clears any prior loading snag
        setOrders(next);
      },
      (message) => setOrderError(message),
    );
    return unsubscribe;
  }, [isAdmin, refreshKey]);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-12 text-center text-soft">Loading…</div>;

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="text-5xl" aria-hidden>🔒</span>
        <h1 className="section-title mt-4">Admins only</h1>
        <p className="mt-2 text-sm text-soft">
          You&apos;re signed in as <span className="font-semibold text-ink">{user.email ?? user.uid}</span> ({user.uid}),
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
  const active = orders?.filter((o) => o.status !== "Delivered" && o.status !== "Cancelled") ?? [];

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
          <button onClick={() => { signOut(auth!); router.push("/"); }} className="btn btn-ghost px-4 py-2 text-xs">
            Sign out
          </button>
        </div>
      </header>

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

      {/* One-click access check — surfaces WHY orders may be hidden. */}
      <details className="mb-6">
        <summary className="cursor-pointer text-sm font-semibold text-chilidark hover:underline">
          🔍 Can&apos;t see orders? Verify admin access
        </summary>
        <div className="card mt-2 p-4 text-sm">
          <button
            onClick={runAccessCheck}
            disabled={checking}
            className="btn btn-ghost mb-3 px-3 py-1.5 text-xs"
          >
            {checking ? "Checking…" : "Run check"}
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

          {/* Bootstrap button — shown when admin doc is missing so admin can create it without touching the console */}
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
        </div>
      </details>

      {/* Status tiles */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-6">
        {(["Order Received", "Confirmed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"] as OrderStatus[]).map((s) => (
          <div key={s} className="card p-3 text-center">
            <p className={`text-2xl font-bold tabular-nums ${s === "Cancelled" ? "text-chili" : "text-chilidark"}`}>
              {counts[s] ?? 0}
            </p>
            <p className="text-[11px] font-semibold leading-tight text-soft">
              {s.replace("Out for Delivery", "Out for delivery")}
            </p>
          </div>
        ))}
      </div>

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

      <div className="space-y-4">
        {active.map((order) => (
          <AdminOrderCard key={order.id} order={order} />
        ))}
        {orders
          ?.filter((o) => o.status === "Delivered" || o.status === "Cancelled")
          .map((order) => <AdminOrderCard key={order.id} order={order} archived />)}
      </div>
    </div>
  );
}

function AccessRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <li className="flex items-start justify-between gap-3">
      <span className="text-soft">{label}:</span>
      <span className={ok ? "font-semibold text-ok" : "font-semibold text-chili"}>
        {ok ? "✓ " : "✗ "}
        {value}
      </span>
    </li>
  );
}

function AdminOrderCard({ order, archived = false }: { order: Order; archived?: boolean }) {
  const [busy, setBusy] = useState(false);
  const time = new Date(order.createdAt).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });

  const changeStatus = async (status: OrderStatus) => {
    if (status === order.status) return;
    setBusy(true);
    try {
      await updateOrderStatus(order.id, status);
    } catch (err) {
      console.error(err);
      const e = err as Error;
      const code = e.name === "FirebaseError" ? (err as { code?: string }).code ?? "" : "";
      alert(
        `Couldn't update the status.\n\n${e.message ?? "Unknown error"}${code ? `\n\n(code: ${code})` : ""}\n\n` +
        "It says READ step → the console READ rule is stale; WRITE step → the console UPDATE rule is stale.\n" +
        "Fix: Firebase console → Firestore → Rules → paste firestore.rules.console-safe → Publish.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`card overflow-hidden ${archived ? "opacity-75" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream/40 px-5 py-3">
        <div>
          <p className="font-display font-bold">{order.orderId}</p>
          <p className="text-xs text-soft">{time}</p>
        </div>
        <span className={`chip border ${STATUS_COLORS[order.status]}`}>
          {order.status}
        </span>
      </header>

      <div className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_auto]">
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
          <p className="text-soft">📍 {order.deliveryAddress}</p>
          {order.notes && <p className="text-soft italic">Notes: {order.notes}</p>}

          <ul className="rounded-xl border border-line bg-paper px-3 py-2">
            {order.items.map((it) => (
              <li key={`${it.menuId}-${it.variant}-${it.qty}`} className="flex justify-between gap-3 py-0.5">
                <span>
                  {it.name}{it.variant ? ` (${it.variant})` : ""} <span className="text-soft">×{it.qty}</span>
                </span>
                <span className="font-semibold">{formatINR(it.lineTotal)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-line/60 pt-1 text-soft">
              <span>Packaging</span><span>{formatINR(order.packagingFee)}</span>
            </li>
            <li className="flex justify-between gap-3 font-bold">
              <span>Total</span><span>{formatINR(order.grandTotal)}</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 md:w-52 md:items-stretch">
          <label className="text-xs font-bold uppercase tracking-wider text-soft" htmlFor={`status-${order.id}`}>
            Update status
          </label>
          <select
            id={`status-${order.id}`}
            value={order.status}
            disabled={busy}
            onChange={(e) => changeStatus(e.target.value as OrderStatus)}
            className="field py-2.5 text-sm font-semibold"
          >
            {[...ORDER_STATUSES, "Cancelled"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <a
            href={`https://wa.me/919606888096?text=${encodeURIComponent(buildOrderMessage(order))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-chili py-2 text-xs"
          >
            Resend to WhatsApp
          </a>
          <span className="hidden text-[11px] text-soft md:block">
            {order.statusHistory.length > 1
              ? `From ${order.statusHistory[0].status} → ${order.statusHistory.slice(1).map((h) => h.status).join(" → ")}`
              : "No changes yet"}
          </span>
        </div>
      </div>
    </article>
  );
}