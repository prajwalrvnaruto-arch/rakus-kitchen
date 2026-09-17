"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/menu";
import { upcomingMeals, validateMeal, type MealOption } from "@/lib/order-dates";
import { createOrder, type OrderDraft } from "@/lib/db";
import { buildOrderMessage } from "@/lib/whatsapp";
import { AddressPicker } from "@/components/AddressPicker";
import { OrderStatusSteps } from "@/components/OrderStatusSteps";
import { WhatsAppIcon } from "@/components/icons";
import type { AddressComponents, Order, OrderLineItem } from "@/types";

type Phase = "form" | "placing" | "done";

export default function CheckoutPage() {
  const { user, loading } = useAuth();
  const { items, itemTotal, packagingFee, grandTotal, clear, setCartOpen } = useCart();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("form");
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // Structured address — replaces the old plain-text `address` string.
  const [addressComponents, setAddressComponents] = useState<AddressComponents | null>(null);
  const [meal, setMeal] = useState<MealOption | null>(null);
  const [notes, setNotes] = useState("");

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

  // Default to the first orderable slot (usually tomorrow's lunch).
  useEffect(() => {
    if (!meal) {
      const first = mealOptions.find((m) => !m.blocked);
      if (first) setMeal(first);
    }
  }, [mealOptions, meal]);

  // Not signed in → redirect to login, then back here.
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=%2Fcheckout");
  }, [loading, user, router]);

  // Stable callback so AddressPicker doesn't re-bind Autocomplete on every render.
  const handleAddressChange = useCallback((addr: AddressComponents | null) => {
    setAddressComponents(addr);
  }, []);

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

  /* ── Confirmation screen (order placed) ─────────────────────────────── */
  if (phase === "done" && placedOrder) {
    const waHref = `https://wa.me/919606888096?text=${encodeURIComponent(buildOrderMessage(placedOrder))}`;
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-turmeric/20 text-4xl" aria-hidden>
            ✅
          </span>
          <h1 className="section-title mt-4">Order placed!</h1>
          <p className="mt-1 text-sm text-soft">
            Your order <span className="font-bold text-ink">{placedOrder.orderId}</span> is in.
            Send it to Raku&apos;s Kitchen on WhatsApp so they can confirm it.
          </p>
        </div>

        <div className="mt-8">
          <OrderStatusSteps status={placedOrder.status} />
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
          {placedOrder.addressComponents && (
            <div className="px-5 py-3 text-soft">
              <span className="block text-xs font-semibold text-soft">Delivery to</span>
              <span className="block font-semibold text-ink">
                {placedOrder.addressComponents.doorAndBuilding}
              </span>
              <span className="block text-xs">{placedOrder.addressComponents.displayAddress}</span>
            </div>
          )}
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
            <span>Total</span><span>{formatINR(placedOrder.grandTotal)}</span>
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
    setError(null);

    if (!user) return;
    if (!meal || !meal.date) {
      setError("Please choose a meal day and slot.");
      return;
    }
    const problem = validateMeal({ date: meal.date, slot: meal.slot });
    if (problem) { setError(problem); return; }

    // Require a confirmed structured address (at minimum the doorAndBuilding field).
    if (!addressComponents) {
      setError("Please search for your delivery address above.");
      return;
    }
    if (addressComponents.doorAndBuilding.trim().length < 3) {
      setError("Please enter your flat / floor / building details.");
      return;
    }

    const lines: OrderLineItem[] = items.map((it) => ({
      menuId: it.menuId,
      name: it.name,
      variant: it.variant,
      qty: it.quantity,
      pricePerUnit: it.price,
      lineTotal: it.price * it.quantity,
    }));

    const draft: OrderDraft = {
      customerName: name.trim(),
      phone: `+91 ${phone}`,
      // Keep a human-readable plain string for backward compat and WhatsApp messages.
      deliveryAddress: [
        addressComponents.doorAndBuilding,
        addressComponents.displayAddress,
        addressComponents.landmark,
      ].filter(Boolean).join(", "),
      // The full structured address — used by Porter for precise delivery.
      addressComponents,
      mealSlot: meal.slot,
      mealDate: meal.date,
      items: lines,
      itemTotal,
      packagingFee,
      grandTotal,
      notes: notes.trim() || undefined,
    };

    setPhase("placing");
    try {
      // Persist structured address for the next visit.
      try {
        window.localStorage.setItem(
          `rk-address-v2-${user.uid}`,
          JSON.stringify(addressComponents),
        );
      } catch { /* ignore storage errors */ }

      const order = await createOrder(user.uid, draft);
      clear();
      setPlacedOrder(order);
      setPhase("done");
    } catch (err) {
      console.error(err);
      setError("We couldn't place your order. Please check your connection and try again.");
      setPhase("form");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <h1 className="section-title mb-2">Checkout</h1>
      <p className="mb-6 text-sm text-soft">
        Orders are made to order — please plan ahead by at least one day.
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

          {/* Delivery address — structured picker */}
          <fieldset className="card p-5">
            <legend className="mb-1 text-sm font-semibold text-ink">Delivery address</legend>
            <p className="mb-3 text-xs text-soft">
              Delivery across Bangalore · Delivery charges are paid by the customer to the delivery partner.
            </p>
            <AddressPicker
              value={addressComponents}
              onChange={handleAddressChange}
            />
          </fieldset>

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

          {error && (
            <p className="rounded-xl border border-chili/30 bg-chili/5 px-4 py-3 text-sm font-medium text-chili" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={phase === "placing"} className="btn btn-chili w-full py-4 text-base">
            {phase === "placing" ? "Placing your order…" : `Place order · ${formatINR(grandTotal)}`}
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
          <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-xs text-soft">
            🛵 Delivery charge is paid to the partner at your door and isn&apos;t included above.
          </p>
        </aside>
      </div>
    </div>
  );
}
