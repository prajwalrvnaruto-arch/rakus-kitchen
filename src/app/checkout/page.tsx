"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { getIdToken } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { auth } from "@/lib/firebase";
import { formatINR } from "@/lib/menu";
import { upcomingMeals, validateMeal, type MealOption } from "@/lib/order-dates";
import { waLinkToKitchen } from "@/lib/whatsapp";
import { BUSINESS } from "@/lib/config";
import { toFriendlyErrorMessage } from "@/lib/friendlyErrors";
import { AddressPicker } from "@/components/AddressPicker";
import { OrderStatusSteps } from "@/components/OrderStatusSteps";
import { WhatsAppIcon } from "@/components/icons";
import type { AddressComponents, FulfillmentType, Order } from "@/types";

type Phase = "form" | "processing" | "verifying" | "done";

/* ── Razorpay Checkout.js types (the SDK ships no types of its own) ──────── */

interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; contact?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

interface CreateOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId?: string;
}

class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

/**
 * Calls one of our /api/payments/* routes with a fresh Firebase ID token.
 * Always force-refreshes the token first — a stale token is the #1 cause of
 * a spurious 401 mid-checkout (see the same pattern in src/lib/db.ts).
 */
async function postJSON<T>(url: string, body: unknown): Promise<T> {
  if (!auth?.currentUser) {
    throw new ApiError("Your session has expired. Please sign in again to continue.", 401);
  }
  let token: string;
  try {
    token = await getIdToken(auth.currentUser, /* forceRefresh */ true);
  } catch {
    throw new ApiError("Your session has expired. Please sign in again to continue.", 401);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; code?: string };
    throw new ApiError(err?.error || `Request failed (${res.status})`, res.status, err?.code);
  }
  return data as T;
}

export default function CheckoutPage() {
  const { user, loading } = useAuth();
  const { items, itemTotal, packagingFee, grandTotal, clear, setCartOpen } = useCart();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("form");
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Held so the "Retry verification" button can replay the exact same
  // signed payload — verify is idempotent, so replaying it is always safe.
  const [pendingVerification, setPendingVerification] = useState<RazorpayHandlerResponse | null>(null);

  // Guards against a double-click / rapid re-submit firing create-order twice.
  // The disabled button is only a visual guard; this ref makes submit itself a
  // no-op while one attempt is already in flight, so we never create two
  // Razorpay orders + payment intents for a single checkout.
  const submitting = useRef(false);

  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("delivery");
  // Structured address — replaces the old plain-text `address` string.
  const [addressComponents, setAddressComponents] = useState<AddressComponents | null>(null);
  const [meal, setMeal] = useState<MealOption | null>(null);
  const [notes, setNotes] = useState("");
  const [consentAgreed, setConsentAgreed] = useState(false);

  const mealOptions = useMemo(() => upcomingMeals(7), []);

  // Restore the last saved structured address for returning customers.
  useEffect(() => {
    if (!user) return;
    try {
      const raw = window.localStorage.getItem(`rk-address-v2-${user.uid}`);
      if (raw) {
        const parsed: AddressComponents = JSON.parse(raw);
        setAddressComponents(parsed);
      }
    } catch { /* storage unavailable or malformed JSON */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Prefill from the verified login number — still editable, since the
  // delivery contact may differ from whoever is signed in.
  useEffect(() => {
    if (user?.phoneNumber) {
      setPhone(user.phoneNumber.replace(/^\+91/, ""));
    }
  }, [user?.phoneNumber]);

  // Default to the first orderable slot (usually tomorrow's lunch).
  useEffect(() => {
    if (!meal) {
      const first = mealOptions.find((m) => !m.blocked);
      if (first) setMeal(first);
    }
  }, [mealOptions, meal]);

  // Not signed in → redirect to login, then back here. Cart + address stay
  // intact (both persisted to localStorage), so a re-login loses no work.
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=%2Fcheckout");
  }, [loading, user, router]);

  // Stable callback so AddressPicker doesn't re-bind Autocomplete on every render.
  const handleAddressChange = useCallback((addr: AddressComponents | null) => {
    setAddressComponents(addr);
  }, []);

  /**
   * Step 2 of payment: hand Razorpay's callback payload to /api/payments/verify.
   * Kept outside `submit` so the "Retry verification" button can call it again
   * with the exact same payload — safe because finalizePayment is idempotent.
   */
  const verifyPayment = useCallback(async (payload: RazorpayHandlerResponse) => {
    setPendingVerification(payload);
    setPhase("verifying");
    setError(null);
    setSessionExpired(false);
    try {
      const { order } = await postJSON<{ order: Order }>("/api/payments/verify", payload);
      clear();
      setPendingVerification(null);
      setPlacedOrder(order);
      setPhase("done");
    } catch (err) {
      console.error("Payment verification failed:", err);
      if (err instanceof ApiError && err.status === 401) setSessionExpired(true);
      setError(toFriendlyErrorMessage(err));
      // Stay on the "verifying" phase — the retry UI renders when error is set.
    }
  }, [clear]);

  const openRazorpayCheckout = useCallback(
    (order: CreateOrderResponse) => {
      if (!order.keyId) {
        setError("Payment is not configured on this server. Please contact support.");
        setPhase("form");
        return;
      }
      if (typeof window.Razorpay !== "function") {
        setError("Could not load the payment window. Please check your connection and try again.");
        setPhase("form");
        return;
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "Raku's Kitchen",
        description: meal ? `${meal.slot} · ${meal.date}` : undefined,
        prefill: {
          name: name.trim() || undefined,
          contact: phone ? `+91${phone}` : undefined,
          email: user?.email ?? undefined,
        },
        theme: { color: "#d94f30" },
        handler: (response) => {
          void verifyPayment(response);
        },
        modal: {
          ondismiss: () => {
            // No order was ever created — the intent just sits inert.
            submitting.current = false;
            setPhase("form");
            setError("Payment was not completed. You can try again when you're ready.");
          },
        },
      });
      rzp.open();
    },
    [meal, name, phone, user?.email, verifyPayment],
  );

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-center text-soft">Loading…</div>;
  }

  if (!user) return null;

  if (items.length === 0 && phase !== "done") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="text-5xl" aria-hidden>🛒</span>
        <h1 className="section-title">Your cart is empty</h1>
        <p className="text-sm text-soft">Add something from the menu first.</p>
        <Link href="/menu" className="btn btn-chili mt-2">Browse menu</Link>
      </div>
    );
  }

  /* ── "Confirming payment" screen (between Checkout and materialized order) ── */
  if (phase === "verifying") {
    return (
      <>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          {error ? (
            <>
              <span className="text-5xl" aria-hidden>⏳</span>
              <h1 className="section-title mt-4">Confirming payment taking a moment</h1>
              <div className="mt-3 rounded-2xl border border-line bg-paper p-4 text-xs text-soft text-left leading-relaxed shadow-sm">
                <p className="font-bold text-ink mb-1">Your payment is safe</p>
                <p>{error}</p>
              </div>
              <div className="mt-6 flex flex-col gap-2.5">
                {sessionExpired ? (
                  <Link href="/login?next=%2Fcheckout" className="btn btn-chili py-3 text-sm font-bold">Sign in again</Link>
                ) : (
                  <button
                    className="btn btn-chili py-3 text-sm font-bold shadow"
                    onClick={() => pendingVerification && verifyPayment(pendingVerification)}
                  >
                    🔄 Retry confirming payment
                  </button>
                )}
                <Link href="/orders" className="btn btn-ghost py-2.5 text-xs">
                  📋 Check My Orders
                </Link>
                <a
                  href={`https://wa.me/919606888096?text=${encodeURIComponent(
                    `Hi Raku's Kitchen, I need assistance verifying my order payment. Payment ID: ${pendingVerification?.razorpay_payment_id || "N/A"}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost py-2.5 text-xs border border-line text-chilidark hover:bg-cream flex items-center justify-center gap-1.5"
                >
                  💬 WhatsApp Kitchen Support
                </a>
              </div>
            </>
          ) : (
            <>
              <span className="text-5xl" aria-hidden>⏳</span>
              <h1 className="section-title mt-4">Confirming your payment…</h1>
              <p className="mt-2 text-sm text-soft">This only takes a moment. Please don&apos;t close this page.</p>
            </>
          )}
        </div>
      </>
    );
  }

  /* ── Confirmation screen (order placed) ─────────────────────────────── */
  if (phase === "done" && placedOrder) {
    const waHref = waLinkToKitchen(placedOrder);
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-turmeric/20 text-4xl" aria-hidden>
            ✅
          </span>
          <h1 className="section-title mt-4">Payment successful!</h1>
          <p className="mt-1 text-sm text-soft">
            Your order <span className="font-bold text-ink">{placedOrder.orderId}</span> is paid and in.
            Send it to Raku&apos;s Kitchen on WhatsApp so they can confirm it.
          </p>
        </div>

        <div className="mt-8">
          <OrderStatusSteps status={placedOrder.status} fulfillmentType={placedOrder.fulfillmentType} />
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
            <span className="font-bold">{placedOrder.orderId}</span>
          </div>
          <div className="flex justify-between px-5 py-3">
            <span className="text-soft">Meal</span>
            <span className="font-semibold">{placedOrder.mealSlot} · {placedOrder.mealDate}</span>
          </div>
          {placedOrder.fulfillmentType === "pickup" ? (
            <div className="px-5 py-3 text-soft">
              <span className="block text-xs font-semibold text-soft">Self-Pickup</span>
              <span className="block font-semibold text-ink">{BUSINESS.kitchenAddress}</span>
              <span className="block text-xs">
                Ready by {placedOrder.mealSlot === "Lunch" ? BUSINESS.readyLunch : BUSINESS.readyDinner}
              </span>
            </div>
          ) : placedOrder.addressComponents ? (
            <div className="px-5 py-3 text-soft">
              <span className="block text-xs font-semibold text-soft">Delivery to</span>
              <span className="block font-semibold text-ink">
                {placedOrder.addressComponents.doorAndBuilding}
              </span>
              <span className="block text-xs">{placedOrder.addressComponents.displayAddress}</span>
            </div>
          ) : null}
          {placedOrder.items.map((it) => (
            <div key={`${it.menuId}-${it.variant}`} className="flex justify-between px-5 py-3">
              <span className="text-soft">
                {it.name}{it.variant ? ` (${it.variant})` : ""} ×{it.qty}
              </span>
              <span className="font-semibold">{formatINR(it.lineTotal)}</span>
            </div>
          ))}
          <div className="flex justify-between px-5 py-3 text-soft">
            <span>Items</span><span>{formatINR(placedOrder.itemTotal)}</span>
          </div>
          <div className="flex justify-between px-5 py-3 text-soft">
            <span>Packaging</span><span>{formatINR(placedOrder.packagingFee)}</span>
          </div>
          <div className="flex justify-between px-5 py-3 text-base font-bold">
            <span>Total paid</span><span>{formatINR(placedOrder.grandTotal)}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link href="/orders" className="btn btn-ghost">Track order</Link>
          <Link href="/menu" className="btn btn-chili">Order something else</Link>
        </div>
      </div>
    );
  }

  /* ── Checkout form ───────────────────────────────────────────────────── */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // No-op if a submission is already in flight (double-click / rapid re-tap),
    // so we never fire create-order twice for one checkout.
    if (submitting.current) return;
    setError(null);
    setSessionExpired(false);

    if (!user) return;
    if (!meal || !meal.date) {
      setError("Please choose a meal day and slot.");
      return;
    }
    const problem = validateMeal({ date: meal.date, slot: meal.slot });
    if (problem) { setError(problem); return; }

    // Require a confirmed structured address for delivery orders only.
    if (fulfillmentType === "delivery") {
      if (!addressComponents) {
        setError("Please search for your delivery address above.");
        return;
      }
      if (addressComponents.doorAndBuilding.trim().length < 3) {
        setError("Please enter your flat / floor / building details.");
        return;
      }
    }

    if (scriptError) {
      setError("Could not load the payment window. Please check your connection and reload the page.");
      return;
    }
    if (!scriptReady) {
      setError("Payment is still loading — please wait a moment and try again.");
      return;
    }

    // Send only what the server needs to independently recompute prices —
    // pricePerUnit/lineTotal are display-only client state and are never sent.
    const lineInputs = items.map((it) => ({
      menuId: it.menuId,
      name: it.name,
      variant: it.variant,
      qty: it.quantity,
    }));

    const requestBody = {
      customerName: name.trim(),
      phone: `+91 ${phone}`,
      fulfillmentType,
      deliveryAddress: fulfillmentType === "delivery" && addressComponents
        ? [
            addressComponents.doorAndBuilding,
            addressComponents.displayAddress,
            addressComponents.landmark,
          ].filter(Boolean).join(", ")
        : "",
      addressComponents: fulfillmentType === "delivery" ? addressComponents : undefined,
      mealSlot: meal.slot,
      mealDate: meal.date,
      items: lineInputs,
      notes: notes.trim() || undefined,
      // Advisory: the total we showed. The server recomputes prices from scratch
      // and charges its own total; this only lets it flag a mid-session change.
      clientGrandTotal: grandTotal,
    };

    submitting.current = true;
    setPhase("processing");
    try {
      // Persist structured address for the next visit.
      try {
        window.localStorage.setItem(
          `rk-address-v2-${user.uid}`,
          JSON.stringify(addressComponents),
        );
      } catch { /* ignore storage errors */ }

      const created = await postJSON<CreateOrderResponse>("/api/payments/create-order", requestBody);
      openRazorpayCheckout(created);
      // Phase stays "processing" while the Razorpay modal is open on top —
      // it moves to "verifying" from the handler, or back to "form" on dismiss/error.
    } catch (err) {
      console.error("Could not start payment:", err);
      if (err instanceof ApiError && err.status === 401) setSessionExpired(true);
      // A price changed mid-session: the shown Total already reflects the live
      // cart, so ask the customer to review it before charging the new amount.
      if (err instanceof ApiError && err.code === "price_changed") {
        setError("Some prices changed since you added items. Please review the updated total above, then pay again.");
      } else if (err instanceof ApiError && err.code === "out_of_service_area") {
        setError((err as Error).message);
      } else if (err instanceof ApiError && err.status === 429) {
        // Rate-limited: the server's message already says to wait a moment.
        setError((err as Error).message);
      } else {
        setError((err as Error).message || "We couldn't start payment. Please check your connection and try again.");
      }
      setPhase("form");
    } finally {
      // Release the guard once the attempt settles (create-order failed, or the
      // Razorpay modal has been handed control). The modal's own handlers move
      // the flow forward from here; a fresh submit is safe again.
      submitting.current = false;
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setScriptError(true)}
      />

      <h1 className="section-title mb-2">Checkout</h1>
      <p className="mb-6 text-sm text-soft">
        Orders are made to order — please plan ahead by at least one day. Payment is collected
        upfront via Razorpay to confirm your order.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <form onSubmit={submit} className="space-y-6">
          {/* Meal day & slot */}
          <fieldset className="card p-5">
            <legend className="mb-1 text-sm font-semibold text-ink">Meal day &amp; slot</legend>
            <p className="mb-3 text-xs text-soft">
              Lunch ready 12:30 PM · Dinner ready 7:30 PM · Closed Mon &amp; Thu · Sunday dinner not served
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {mealOptions.map((option, i) => {
                const selected = meal?.date === option.date && meal?.slot === option.slot;
                return (
                  <button
                    key={`${option.date}-${option.slot}-${i}`}
                    type="button"
                    disabled={option.blocked}
                    onClick={() => setMeal(option)}
                    className={`rounded-xl border-2 px-3 py-2.5 text-left text-sm transition ${
                      option.blocked
                        ? "cursor-not-allowed border-line/50 bg-cream/40 text-soft/50 line-through"
                        : selected
                          ? "border-chili bg-chili/5 font-semibold text-chilidark"
                          : "border-line bg-paper text-ink hover:border-soft"
                    }`}
                  >
                    <span className="block font-semibold">{option.label}</span>
                    <span className="text-xs opacity-80">
                      {option.slot} {option.blocked ? `· ${option.reason}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Contact details */}
          <fieldset className="card p-5">
            <legend className="mb-3 text-sm font-semibold text-ink">Your details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-semibold">Full name</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label htmlFor="cphone" className="mb-1.5 block text-sm font-semibold">Mobile number</label>
                <input
                  id="cphone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                  className="field"
                  placeholder="10-digit mobile"
                  required
                />
              </div>
            </div>
          </fieldset>

          {/* Fulfillment type toggle */}
          <fieldset className="card p-5">
            <legend className="mb-3 text-sm font-semibold text-ink">How would you like to receive your order?</legend>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFulfillmentType("delivery")}
                className={`rounded-xl border-2 px-4 py-3 text-left text-sm transition ${
                  fulfillmentType === "delivery"
                    ? "border-chili bg-chili/5 font-semibold text-chilidark"
                    : "border-line bg-paper text-ink hover:border-soft"
                }`}
              >
                <span className="block text-lg" aria-hidden>🛵</span>
                <span className="block font-semibold">Delivery</span>
                <span className="text-xs opacity-80">We'll deliver to your address</span>
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentType("pickup")}
                className={`rounded-xl border-2 px-4 py-3 text-left text-sm transition ${
                  fulfillmentType === "pickup"
                    ? "border-chili bg-chili/5 font-semibold text-chilidark"
                    : "border-line bg-paper text-ink hover:border-soft"
                }`}
              >
                <span className="block text-lg" aria-hidden>🏠</span>
                <span className="block font-semibold">Self-Pickup</span>
                <span className="text-xs opacity-80">Collect from the kitchen</span>
              </button>
            </div>
          </fieldset>

          {/* Delivery address — shown only for delivery */}
          {fulfillmentType === "delivery" ? (
            <fieldset className="card p-5">
              <legend className="mb-1 text-sm font-semibold text-ink">Delivery address</legend>
              <p className="mb-3 text-xs text-soft">
                Delivery across Bangalore · Delivery charges are paid by the customer to the delivery partner.
              </p>
              <AddressPicker
                value={addressComponents}
                onChange={handleAddressChange}
              />
              {addressComponents && (
                <div className="mt-2.5 flex items-center justify-between text-xs text-soft">
                  <span>📍 Coordinates saved locally for fast re-ordering</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAddressComponents(null);
                      if (user?.uid) {
                        try {
                          window.localStorage.removeItem(`rk-address-v2-${user.uid}`);
                        } catch { /* ignore */ }
                      }
                    }}
                    className="font-medium text-chilidark underline hover:text-ink"
                    title="Right to Erasure under DPDP Act: wipe saved address coordinates from this device"
                  >
                    Clear saved address
                  </button>
                </div>
              )}
            </fieldset>
          ) : (
            <div className="card p-5">
              <h3 className="mb-2 text-sm font-semibold text-ink">Pickup location</h3>
              <div className="rounded-lg bg-cream/60 p-4">
                <p className="font-semibold text-ink">{BUSINESS.name}</p>
                <p className="mt-1 text-sm text-soft">{BUSINESS.kitchenAddress}</p>
                <a
                  href={`https://maps.google.com/?q=${BUSINESS.lat},${BUSINESS.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-semibold text-chilidark hover:underline"
                >
                  Open in Google Maps →
                </a>
                <div className="mt-3 border-t border-line/60 pt-3 text-sm">
                  <p className="font-semibold text-ink">Ready times</p>
                  <p className="text-soft">Lunch: {BUSINESS.readyLunch} · Dinner: {BUSINESS.readyDinner}</p>
                </div>
              </div>
            </div>
          )}

          {/* Order note */}
          <fieldset className="card p-5">
            <legend className="mb-1.5 text-sm font-semibold text-ink">Order note (optional)</legend>
            <input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="field"
              placeholder="Any instructions for the kitchen?"
            />
          </fieldset>

          {/* DPDP Act 2023 Statutory Affirmative Consent & Privacy Notice */}
          <div className="rounded-2xl border border-line bg-cream/50 p-4 text-xs text-soft space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <span>🛡️</span>
              <span>DPDP Act, 2023 Statutory Consent</span>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                id="dpdp-affirmative-consent"
                checked={consentAgreed}
                onChange={(e) => setConsentAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line text-chili focus:ring-chili shrink-0"
                required
              />
              <span className="leading-relaxed text-ink/90">
                I hereby grant affirmative consent to Raku&apos;s Kitchen to process my name, mobile number, and address strictly for meal preparation, rider dispatch, and status alerts as per the{" "}
                <Link href="/privacy" target="_blank" className="font-semibold text-chilidark underline hover:text-ink">
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link href="/terms" target="_blank" className="font-semibold text-chilidark underline hover:text-ink">
                  Terms of Service
                </Link>.
              </span>
            </label>
          </div>

          {error && (
            <div className="rounded-xl border border-chili/30 bg-chili/5 px-4 py-3 text-sm font-medium text-chili" role="alert">
              <p>{error}</p>
              {sessionExpired && (
                <Link href="/login?next=%2Fcheckout" className="mt-2 inline-block font-bold underline">
                  Sign in again
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={phase === "processing" || !consentAgreed}
            className="btn btn-chili w-full py-4 text-base disabled:opacity-50"
            title={!consentAgreed ? "Please check the consent box above to proceed" : ""}
          >
            {phase === "processing" ? "Starting payment…" : `Pay ${formatINR(grandTotal)}`}
          </button>
        </form>

        {/* Order summary */}
        <aside className="card h-fit p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Summary</h2>
            <button
              onClick={() => setCartOpen(true)}
              className="text-sm font-semibold text-chilidark hover:underline"
            >
              Edit cart
            </button>
          </div>
          <ul className="divide-y divide-line/60 text-sm">
            {items.map((it) => (
              <li key={`${it.menuId}-${it.variant}`} className="flex justify-between gap-3 py-2.5">
                <span className="text-soft">
                  {it.name}{it.variant ? ` (${it.variant})` : ""} ×{it.quantity}
                </span>
                <span className="font-semibold">{formatINR(it.price * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between text-soft"><span>Items</span><span>{formatINR(itemTotal)}</span></div>
            <div className="flex justify-between text-soft"><span>Packaging (₹20/item)</span><span>{formatINR(packagingFee)}</span></div>
            <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatINR(grandTotal)}</span></div>
          </div>
          {fulfillmentType === "delivery" && (
            <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-xs text-soft">
              🛵 Delivery charge is paid to the partner at your door and isn&apos;t included above.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
