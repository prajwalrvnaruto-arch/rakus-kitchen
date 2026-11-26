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
import { BUSINESS } from "@/lib/config";
import { normalizeIndianMobile } from "@/lib/phone";
import { toFriendlyErrorMessage } from "@/lib/friendlyErrors";
import { AddressPicker } from "@/components/AddressPicker";
import { WhatsAppIcon } from "@/components/icons";
import type { AddressComponents, FulfillmentType } from "@/types";

type Phase = "form" | "processing";

/* ── Cashfree JS SDK types ───────────────────────────────────────────────── */

interface CashfreeCheckoutOptions {
  paymentSessionId: string;
  redirectTarget?: "_self" | "_blank" | "_top" | "_modal";
}

/** Result of checkout() in `_modal` mode. `error` is set when the customer
 *  closes the popup or payment fails; `paymentDetails` when it completes. */
interface CashfreeCheckoutResult {
  error?: { message?: string };
  redirect?: boolean;
  paymentDetails?: unknown;
}

interface CashfreeInstance {
  checkout: (options: CashfreeCheckoutOptions) => Promise<CashfreeCheckoutResult | void>;
}

declare global {
  interface Window {
    Cashfree?: (config: { mode: "sandbox" | "production" }) => CashfreeInstance;
  }
}

interface CreateOrderResponse {
  cashfreeOrderId: string;
  paymentSessionId: string;
  amount: number;
  currency: string;
  mode: "sandbox" | "production";
}

class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

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
  const { items, itemTotal, packagingFee, grandTotal } = useCart();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const submitting = useRef(false);

  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("delivery");
  const [addressComponents, setAddressComponents] = useState<AddressComponents | null>(null);
  const [meal, setMeal] = useState<MealOption | null>(null);
  const [notes, setNotes] = useState("");
  const [consentAgreed, setConsentAgreed] = useState(false);

  const [deliveryFeeEstimate, setDeliveryFeeEstimate] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const lastEstimatedKeyRef = useRef<string | null>(null);

  const mealOptions = useMemo(() => upcomingMeals(7), []);

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

  useEffect(() => {
    if (user?.phoneNumber) {
      setPhone(user.phoneNumber.replace(/^\+91/, ""));
    }
  }, [user?.phoneNumber]);

  useEffect(() => {
    if (!meal) {
      const first = mealOptions.find((m) => !m.blocked);
      if (first) setMeal(first);
    }
  }, [mealOptions, meal]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=%2Fcheckout");
  }, [loading, user, router]);

  const handleAddressChange = useCallback((addr: AddressComponents | null) => {
    setAddressComponents(addr);
  }, []);

  useEffect(() => {
    if (fulfillmentType !== "delivery" || !addressComponents) {
      setDeliveryFeeEstimate(null);
      lastEstimatedKeyRef.current = null;
      return;
    }

    const key = `${addressComponents.lat},${addressComponents.lng}`;
    if (key === lastEstimatedKeyRef.current) return;

    const timer = setTimeout(async () => {
      lastEstimatedKeyRef.current = key;
      setEstimateLoading(true);
      try {
        const result = await postJSON<{ deliveryFee: number }>("/api/delivery/borzo/estimate", {
          dropAddress: addressComponents.displayAddress,
          lat: addressComponents.lat,
          lng: addressComponents.lng,
          pincode: addressComponents.pincode,
          state: addressComponents.state,
        });
        setDeliveryFeeEstimate(result.deliveryFee);
      } catch (err) {
        console.error("Delivery fee estimate failed:", err);
        setDeliveryFeeEstimate(null);
      } finally {
        setEstimateLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [fulfillmentType, addressComponents]);

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-center text-soft">Loading…</div>;
  }

  if (!user) return null;

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="text-5xl" aria-hidden>🛒</span>
        <h1 className="section-title">Your cart is empty</h1>
        <p className="text-sm text-soft">Add something from the menu first.</p>
        <Link href="/menu" className="btn btn-chili mt-2">Browse menu</Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    setError(null);
    setSessionExpired(false);

    if (!user) return;
    if (!normalizeIndianMobile(phone).digits10) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!meal || !meal.date) {
      setError("Please choose a meal day and slot.");
      return;
    }
    const problem = validateMeal({ date: meal.date, slot: meal.slot });
    if (problem) { setError(problem); return; }

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

    if (typeof window.Cashfree !== "function") {
      setError("Could not load the payment window. Please check your connection and try again.");
      return;
    }

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
      clientGrandTotal: grandTotal,
    };

    submitting.current = true;
    setPhase("processing");
    try {
      try {
        window.localStorage.setItem(
          `rk-address-v2-${user.uid}`,
          JSON.stringify(addressComponents),
        );
      } catch { /* ignore storage errors */ }

      const created = await postJSON<CreateOrderResponse>("/api/payments/create-order", requestBody);

      const cashfree = window.Cashfree({ mode: created.mode });

      // Popup over the page, so Back never leaves the app.
      const result = await cashfree.checkout({
        paymentSessionId: created.paymentSessionId,
        redirectTarget: "_modal",
      });

      if (result && result.error && !result.paymentDetails) {
        // Popup closed or payment failed. The server-side intent stays inert.
        setError("Payment was not completed. You can try again when you're ready.");
        setPhase("form");
        return;
      }
      // Paid (or the SDK fell back to a redirect): /checkout/confirm
      // re-checks the order with Cashfree before creating it.
      router.push(`/checkout/confirm?order_id=${encodeURIComponent(created.cashfreeOrderId)}`);
    } catch (err) {
      console.error("Could not start payment:", err);
      if (err instanceof ApiError && err.status === 401) setSessionExpired(true);
      if (err instanceof ApiError && err.code === "price_changed") {
        setError("Some prices changed since you added items. Please review the updated total above, then pay again.");
      } else if (err instanceof ApiError && (err.code === "out_of_service_area" || err.code === "invalid_phone" || err.code === "field_too_long")) {
        setError((err as Error).message);
      } else if (err instanceof ApiError && err.status === 429) {
        setError((err as Error).message);
      } else {
        setError((err as Error).message || "We couldn't start payment. Please check your connection and try again.");
      }
      setPhase("form");
    } finally {
      submitting.current = false;
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      {/* Cashfree JS SDK — loaded from their official CDN */}
      <Script
        src="https://sdk.cashfree.com/js/v3/cashfree.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setScriptError(true)}
      />

      <h1 className="section-title mb-2">Checkout</h1>
      <p className="mb-6 text-sm text-soft">
        Orders are made to order — please plan ahead by at least one day. Payment is collected
        upfront via Cashfree to confirm your order.
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
                  maxLength={80}
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
                <span className="text-xs opacity-80">We&apos;ll deliver to your address</span>
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

          {/* Delivery address */}
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
              {addressComponents && (estimateLoading || deliveryFeeEstimate !== null) && (
                <p className="mt-2.5 rounded-lg bg-cream px-3 py-2 text-xs text-soft">
                  {estimateLoading
                    ? "Estimating delivery fee…"
                    : `Estimated delivery fee: ${formatINR(deliveryFeeEstimate!)} — final amount collected by the rider.`}
                </p>
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
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="field"
              placeholder="Any instructions for the kitchen?"
            />
          </fieldset>

          {/* DPDP Act 2023 Statutory Affirmative Consent */}
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
            <>
              {(estimateLoading || deliveryFeeEstimate !== null) && (
                <div className="mt-3 flex justify-between text-sm text-soft">
                  <span>Estimated delivery fee</span>
                  <span className="font-semibold">
                    {estimateLoading ? "…" : formatINR(deliveryFeeEstimate!)}
                  </span>
                </div>
              )}
              <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-xs text-soft">
                🛵 Delivery charge is paid to the partner at your door and isn&apos;t included above.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
