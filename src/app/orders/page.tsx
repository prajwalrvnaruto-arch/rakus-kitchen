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
import { buildOrderMessage } from "@/lib/whatsapp";
import { OrderStatusSteps } from "@/components/OrderStatusSteps";
import { WhatsAppIcon } from "@/components/icons";
import type { Order } from "@/types";

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const { add, setCartOpen } = useCart();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=%2Forders");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeMyOrders(user.uid, setOrders);
    return unsubscribe;
  }, [user?.uid]);

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
      <p className="mb-6 text-sm text-soft">
        Tracking your orders on {user.email ?? "this account"}. Status updates here live as
        the kitchen progresses your order.
      </p>

      {orders !== null && orders.length === 0 && (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <span className="text-5xl" aria-hidden>🍲</span>
          <p className="font-semibold">No orders yet</p>
          <p className="max-w-xs text-sm text-soft">
            When you place an order it'll show up here with live tracking.
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

      <div className="space-y-5">
        {orders?.map((order) => (
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
              <OrderStatusSteps status={order.status} />
            </div>

            <div className="border-t border-line px-5 py-3">
              <p className="text-sm text-soft">
                <span className="font-semibold text-ink">{order.mealSlot}</span> · {order.mealDate} ·{" "}
                {order.items.map((it) => `${it.name}${it.variant ? ` (${it.variant})` : ""} ×${it.qty}`).join(", ")}
              </p>
            </div>

            <footer className="flex flex-col gap-2 border-t border-line px-5 py-3 sm:flex-row">
              <a
                href={`https://wa.me/919606888096?text=${encodeURIComponent(buildOrderMessage(order))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-chili flex-1 px-4 py-2 text-xs"
              >
                <WhatsAppIcon className="h-4 w-4" /> Send to kitchen
              </a>
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
    </div>
  );
}