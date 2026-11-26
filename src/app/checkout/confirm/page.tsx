"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getIdToken } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { auth } from "@/lib/firebase";
import { formatINR } from "@/lib/menu";
import { waLinkToKitchen } from "@/lib/whatsapp";
import { BUSINESS } from "@/lib/config";
import { toFriendlyErrorMessage } from "@/lib/friendlyErrors";
import { OrderStatusSteps } from "@/components/OrderStatusSteps";
import { InvoiceDownloadButton } from "@/components/InvoiceDownloadButton";
import { WhatsAppIcon } from "@/components/icons";
import type { Order } from "@/types";

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function verifyPayment(cashfreeOrderId: string): Promise<Order> {
  if (!auth?.currentUser) throw new ApiError("Your session has expired. Please sign in again.", 401);
  let token: string;
  try {
    token = await getIdToken(auth.currentUser, true);
  } catch {
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }
  const res = await fetch("/api/payments/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cashfreeOrderId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string };
    throw new ApiError(err?.error || `Verification failed (${res.status})`, res.status);
  }
  return (data as { order: Order }).order;
}

/**
 * Cashfree redirects to /checkout/confirm?order_id=<cashfreeOrderId> after
 * the customer completes (or abandons) payment. We call /api/payments/verify
 * which re-fetches order status from Cashfree directly — the redirect URL is
 * not signed so we never trust the query param alone.
 */
export default function CheckoutConfirmPage() {
  const { user, loading } = useAuth();
  const { clear } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cashfreeOrderId = searchParams.get("order_id");

  const [phase, setPhase] = useState<"verifying" | "done" | "error">("verifying");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const verifying = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?next=%2Fcheckout");
      return;
    }
    if (!user || !cashfreeOrderId || verifying.current) return;
    verifying.current = true;

    verifyPayment(cashfreeOrderId)
      .then((confirmed) => {
        clear();
        setOrder(confirmed);
        setPhase("done");
      })
      .catch((err) => {
        console.error("Payment verification failed:", err);
        if (err instanceof ApiError && err.status === 401) setSessionExpired(true);
        setError(toFriendlyErrorMessage(err));
        setPhase("error");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, cashfreeOrderId]);

  if (loading || phase === "verifying") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="text-5xl" aria-hidden>⏳</span>
        <h1 className="section-title mt-4">Confirming your payment…</h1>
        <p className="mt-2 text-sm text-soft">This only takes a moment. Please don&apos;t close this page.</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="text-5xl" aria-hidden>⏳</span>
        <h1 className="section-title mt-4">Confirming payment taking a moment</h1>
        <div className="mt-3 rounded-2xl border border-line bg-paper p-4 text-xs text-soft text-left leading-relaxed shadow-sm">
          <p className="font-bold text-ink mb-1">Your payment is safe</p>
          <p>{error}</p>
        </div>
        <div className="mt-6 flex flex-col gap-2.5">
          {sessionExpired ? (
            <Link href="/login?next=%2Fcheckout" className="btn btn-chili py-3 text-sm font-bold">
              Sign in again
            </Link>
          ) : (
            <button
              className="btn btn-chili py-3 text-sm font-bold shadow"
              onClick={() => {
                if (!cashfreeOrderId) return;
                verifying.current = false;
                setPhase("verifying");
                setError(null);
                verifyPayment(cashfreeOrderId)
                  .then((confirmed) => { clear(); setOrder(confirmed); setPhase("done"); })
                  .catch((err) => {
                    if (err instanceof ApiError && err.status === 401) setSessionExpired(true);
                    setError(toFriendlyErrorMessage(err));
                    setPhase("error");
                  });
              }}
            >
              🔄 Retry confirming payment
            </button>
          )}
          <Link href="/orders" className="btn btn-ghost py-2.5 text-xs">
            📋 Check My Orders
          </Link>
          <a
            href={`https://wa.me/919606888096?text=${encodeURIComponent(
              `Hi Raku's Kitchen, I need help verifying my payment. Order ID: ${cashfreeOrderId ?? "N/A"}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost py-2.5 text-xs border border-line text-chilidark hover:bg-cream flex items-center justify-center gap-1.5"
          >
            💬 WhatsApp Kitchen Support
          </a>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const waHref = waLinkToKitchen(order);

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-turmeric/20 text-4xl" aria-hidden>
          ✅
        </span>
        <h1 className="section-title mt-4">Payment successful!</h1>
        <p className="mt-1 text-sm text-soft">
          Your order <span className="font-bold text-ink">{order.orderId}</span> is paid and in.
          Send it to Raku&apos;s Kitchen on WhatsApp so they can confirm it.
        </p>
      </div>

      <div className="mt-8">
        <OrderStatusSteps status={order.status} fulfillmentType={order.fulfillmentType} />
      </div>

      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-chili mt-8 w-full py-4 text-base"
      >
        <WhatsAppIcon className="h-5 w-5" />
        Send order on WhatsApp
      </a>
      <p className="mt-2 text-center text-xs text-soft">
        The kitchen will see your order and call you to confirm delivery.
        You can also track it anytime from <strong>My Orders</strong>.
      </p>

      <div className="card mt-6 divide-y divide-line/60 text-sm">
        <div className="flex justify-between px-5 py-3">
          <span className="text-soft">Order ID</span>
          <span className="font-bold">{order.orderId}</span>
        </div>
        <div className="flex justify-between px-5 py-3">
          <span className="text-soft">Meal</span>
          <span className="font-semibold">{order.mealSlot} · {order.mealDate}</span>
        </div>
        {order.fulfillmentType === "pickup" ? (
          <div className="px-5 py-3 text-soft">
            <span className="block text-xs font-semibold text-soft">Self-Pickup</span>
            <span className="block font-semibold text-ink">{BUSINESS.kitchenAddress}</span>
            <span className="block text-xs">
              Ready by {order.mealSlot === "Lunch" ? BUSINESS.readyLunch : BUSINESS.readyDinner}
            </span>
          </div>
        ) : order.addressComponents ? (
          <div className="px-5 py-3 text-soft">
            <span className="block text-xs font-semibold text-soft">Delivery to</span>
            <span className="block font-semibold text-ink">
              {order.addressComponents.doorAndBuilding}
            </span>
            <span className="block text-xs">{order.addressComponents.displayAddress}</span>
          </div>
        ) : null}
        {order.items.map((it) => (
          <div key={`${it.menuId}-${it.variant}`} className="flex justify-between px-5 py-3">
            <span className="text-soft">
              {it.name}{it.variant ? ` (${it.variant})` : ""} ×{it.qty}
            </span>
            <span className="font-semibold">{formatINR(it.lineTotal)}</span>
          </div>
        ))}
        <div className="flex justify-between px-5 py-3 text-soft">
          <span>Items</span><span>{formatINR(order.itemTotal)}</span>
        </div>
        <div className="flex justify-between px-5 py-3 text-soft">
          <span>Packaging</span><span>{formatINR(order.packagingFee)}</span>
        </div>
        <div className="flex justify-between px-5 py-3 text-base font-bold">
          <span>Total paid</span><span>{formatINR(order.grandTotal)}</span>
        </div>
      </div>

      <div className="mt-6 text-center">
        <InvoiceDownloadButton
          orderId={order.id}
          orderDisplayId={order.orderId}
          variant="primary"
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link href="/orders" className="btn btn-ghost">Track order</Link>
        <Link href="/menu" className="btn btn-chili">Order something else</Link>
      </div>
    </div>
  );
}
