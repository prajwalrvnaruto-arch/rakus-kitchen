"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { subscribeMyOrders } from "@/lib/db";
import { formatINR, menuItemById } from "@/lib/menu";
import { waLinkToKitchen } from "@/lib/whatsapp";
import { useClientOrderAlerts } from "@/lib/client-order-alerts-context";
import { OrderStatusSteps } from "@/components/OrderStatusSteps";
import { WhatsAppIcon } from "@/components/icons";
import { BUSINESS } from "@/lib/config";
import type { Order } from "@/types";

// The customer-facing filter is simpler than the admin's: people think
// "what's coming" vs "what's done", not in kitchen-workflow terms.
type OrderFilter = "active" | "past" | "all";
const FILTERS: OrderFilter[] = ["active", "past", "all"];
const FILTER_LABELS: Record<OrderFilter, string> = {
  active: "Active",
  past: "Past",
  all: "All",
};
const isPastStatus = (s: Order["status"]) => s === "Delivered" || s === "Cancelled";

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const { add, setCartOpen } = useCart();
  const { soundEnabled, toggleSound, requestNotificationPermission, notificationPermission } = useClientOrderAlerts();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<OrderFilter>("active");

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=%2Forders");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeMyOrders(user.uid, setOrders);
    return unsubscribe;
  }, [user?.uid]);

  // Auto-switch from Active to All when orders have loaded and none are active —
  // prevents returning customers landing on an empty tab.
  useEffect(() => {
    if (!orders) return;
    const hasActive = orders.some((o) => !isPastStatus(o.status));
    if (filter === "active" && !hasActive && orders.length > 0) setFilter("all");
  }, [orders, filter]);

  const handleReorder = (order: Order) => {
    for (const it of order.items) {
      add({
        menuId: it.menuId,
        name: it.name,
        emoji: menuItemById(it.menuId)?.emoji ?? "🍽️",
        price: it.pricePerUnit,
        quantity: it.qty,
        variant: it.variant,
      });
    }
    router.push("/checkout");
  };

  if (loading || !user) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-center text-soft">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="section-title">My orders</h1>
        <button
          onClick={() => {
            signOut(auth!);
            router.push("/");
          }}
          className="btn btn-ghost px-4 py-2 text-xs"
        >
          Sign out
        </button>
      </div>
      <p className="mb-4 text-sm text-soft">
        Tracking your orders on {user.phoneNumber ?? user.email ?? "this account"}. Status
        updates here live as the kitchen progresses your order.
      </p>

      {/* Live notification controller bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper/90 px-4 py-3 text-xs shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ok"></span>
          </span>
          <span className="font-semibold text-ink">Live Order Tracking Active</span>
        </div>
        <div className="flex items-center gap-2">
          {notificationPermission === "default" && (
            <button
              onClick={() => { void requestNotificationPermission(); }}
              className="btn btn-ghost px-2.5 py-1 text-xs border border-line text-chilidark hover:bg-cream"
            >
              🔔 Enable Notifications
            </button>
          )}
          {notificationPermission === "granted" && (
            <span className="text-[11px] text-ok font-medium flex items-center gap-1">
              ✓ Notifications On
            </span>
          )}
          <button
            onClick={toggleSound}
            className="btn btn-ghost px-2.5 py-1 text-xs"
            title={soundEnabled ? "Mute order chimes" : "Enable order chimes"}
          >
            {soundEnabled ? "🔊 Chimes On" : "🔇 Chimes Muted"}
          </button>
        </div>
      </div>

      {orders !== null && orders.length > 0 && (() => {
        const activeOrders = orders.filter((o) => !isPastStatus(o.status));
        const pastOrders = orders.filter((o) => isPastStatus(o.status));
        const visibleOrders =
          filter === "past" ? pastOrders
          : filter === "active" ? activeOrders
          : orders;

        return (
          <>
            {/* Filter tabs */}
            <div
              role="tablist"
              aria-label="Filter orders"
              className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
            >
              {FILTERS.map((f) => {
                const count = f === "active" ? activeOrders.length : f === "past" ? pastOrders.length : orders.length;
                const selected = filter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setFilter(f)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      selected
                        ? "border-chili bg-chili text-cream"
                        : "border-line bg-paper text-ink hover:border-soft"
                    }`}
                  >
                    {FILTER_LABELS[f]}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${selected ? "bg-cream/20" : "bg-cream"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Empty state per tab */}
            {visibleOrders.length === 0 && filter === "active" && (
              <div className="card flex flex-col items-center gap-3 p-10 text-center">
                <span className="text-4xl" aria-hidden>✅</span>
                <p className="font-semibold">No active orders right now</p>
                <p className="max-w-xs text-sm text-soft">Your next order will appear here live.</p>
                <Link href="/menu" className="btn btn-chili mt-1">Order now</Link>
              </div>
            )}
            {visibleOrders.length === 0 && filter === "past" && (
              <div className="card p-8 text-center text-sm text-soft">No past orders yet.</div>
            )}

            {/* Order list */}
            <div className="space-y-5">
              {visibleOrders.map((order) => (
                <article key={order.id} className="card overflow-hidden">
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-cream/40 px-5 py-3">
                    <div>
                      <p className="font-display text-base font-bold">{order.orderId}</p>
                      <p className="text-xs text-soft">
                        {new Date(order.createdAt).toLocaleString("en-IN", {
                          day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-bold ${order.status === "Cancelled" ? "text-chili" : "text-chilidark"}`}>
                        {order.status}
                      </p>
                      <p className="text-sm font-bold">{formatINR(order.grandTotal)}</p>
                    </div>
                  </header>

                  <div className="px-5 py-4">
                    <OrderStatusSteps status={order.status} fulfillmentType={order.fulfillmentType} />
                  </div>

                  <div className="border-t border-line px-5 py-3">
                    <p className="text-sm text-soft">
                      <span className="font-semibold text-ink">{order.mealSlot}</span> · {order.mealDate} ·{" "}
                      {order.items.map((it) => `${it.name}${it.variant ? ` (${it.variant})` : ""} ×${it.qty}`).join(", ")}
                    </p>
                  </div>

                  <footer className="flex flex-col gap-2 border-t border-line px-5 py-3 sm:flex-row">
                    {order.status === "Confirmed" && (
                      <a
                        href={waLinkToKitchen(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-chili flex-1 px-4 py-2 text-xs"
                      >
                        <WhatsAppIcon className="h-4 w-4" /> Send to kitchen
                      </a>
                    )}
                    <button
                      onClick={() => {
                        setCartOpen(false);
                        handleReorder(order);
                      }}
                      className="btn btn-ghost flex-1 px-4 py-2 text-xs"
                    >
                      Reorder
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          </>
        );
      })()}

      {orders !== null && orders.length === 0 && (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <span className="text-5xl" aria-hidden>🍲</span>
          <p className="font-semibold">No orders yet</p>
          <p className="max-w-xs text-sm text-soft">
            When you place an order it&apos;ll show up here with live tracking.
          </p>
          <Link href="/menu" className="btn btn-chili mt-1">Order now</Link>
        </div>
      )}

      {orders === null && (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="card h-44 animate-pulse bg-cream/60 p-5" />
          ))}
        </div>
      )}

      {/* ── DPDP Act 2023: Customer Privacy & Data Protection Rights ── */}
      <section className="mt-10 rounded-2xl border border-line bg-cream/40 p-5 text-xs text-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <h2 className="font-display text-sm font-bold text-ink">
              Your Privacy &amp; Data Rights (DPDP Act, 2023)
            </h2>
          </div>
          <span className="rounded-full bg-ok/10 border border-ok/30 px-2.5 py-0.5 text-[11px] font-semibold text-ok">
            Data Principal Rights
          </span>
        </div>

        <p className="leading-relaxed">
          Signed in as <span className="font-semibold text-ink">{user?.phoneNumber || "Customer"}</span>.
          Under the Digital Personal Data Protection Act, 2023, you have statutory rights to access your order history,
          correct details, or request erasure of personal data that is no longer required for delivery or statutory accounting.
        </p>

        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              if (user?.uid) {
                try {
                  window.localStorage.removeItem(`rk-address-v2-${user.uid}`);
                  alert("Saved address coordinates have been wiped from this device.");
                } catch { /* ignore */ }
              }
            }}
            className="rounded-xl border border-line bg-paper px-3 py-2 text-xs font-semibold text-ink hover:border-chili transition"
            title="Right to Erasure under Section 12 of DPDP Act"
          >
            🗑️ Wipe saved address from this device
          </button>

          <a
            href={`mailto:${BUSINESS.grievanceOfficer.email}?subject=DPDP%20Data%20Request&body=Hi%20Grievance%20Officer%2C%0A%0AI%20am%20exercising%20my%20Data%20Principal%20rights%20under%20the%20DPDP%20Act%202023%20for%20phone%20number%20${user?.phoneNumber || ""}.`}
            className="rounded-xl border border-line bg-paper px-3 py-2 text-xs font-semibold text-chilidark hover:underline flex items-center gap-1.5"
          >
            ⚖️ Contact Grievance Officer
          </a>

          <Link
            href="/privacy"
            className="rounded-xl border border-line bg-paper px-3 py-2 text-xs font-semibold text-ink hover:text-chilidark hover:underline"
          >
            Read Privacy Notice →
          </Link>
        </div>
      </section>
    </div>
  );
}