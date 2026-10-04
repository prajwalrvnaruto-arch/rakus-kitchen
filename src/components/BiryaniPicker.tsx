"use client";

import { useState } from "react";
import Image from "next/image";
import type { BiryaniMeat, BiryaniWeight } from "@/types";
import {
  BIRYANI_PRICING, BIRYANI_RATIO, biryaniVariantLabel, formatINR,
  EXTRA_MEAT_GRAMS, EXTRA_MEAT_PRICE, EXTRA_MEAT_MAX_UNITS, extraMeatLabel, extraMeatMenuId,
} from "@/lib/menu";
import { useCart } from "@/lib/cart-context";
import { useMenuAvailability } from "@/lib/menu-availability-context";
import { canAddToCart, deriveAvailability, itemHasQuantityLimit, maxAddableQty, DEFAULT_ITEM_LIMIT } from "@/lib/menuLimits";
import { menuItemById } from "@/lib/menu";
import { QtyStepper } from "./QtyStepper";
import { CartIcon } from "./icons";
import { BiryaniExtraMeatModal } from "./BiryaniExtraMeatModal";

const WEIGHTS: BiryaniWeight[] = [0.5, 1, 2, 3];
const MEATS: { key: BiryaniMeat; label: string; photo: string }[] = [
  { key: "chicken", label: "Chicken", photo: "/images/dishes/biryani-chicken.webp" },
  { key: "mutton", label: "Mutton", photo: "/images/dishes/biryani-mutton.webp" },
];

export function BiryaniPicker() {
  const { add, items: cartItems } = useCart();
  const { configs } = useMenuAvailability();
  const [meat, setMeat] = useState<BiryaniMeat>("chicken");
  const [weight, setWeight] = useState<BiryaniWeight>(1);
  const [qty, setQty] = useState(1);
  const [extraMeatQty, setExtraMeatQty] = useState(0);
  const [showExtraModal, setShowExtraModal] = useState(false);

  const menuId = `biryani-${meat}`;
  const cfg = configs[menuId];
  const availabilityCfg = {
    orderedQty: cfg?.orderedQty ?? 0,
    limit: cfg?.limit ?? DEFAULT_ITEM_LIMIT,
    manualOverride: cfg?.manualOverride ?? null,
  };
  const unavailable = deriveAvailability(availabilityCfg) === "unavailable";

  const price = BIRYANI_PRICING[weight][meat];
  const ratio = BIRYANI_RATIO[weight];
  const unitLabel = biryaniVariantLabel(weight, meat);
  const extraPrice = EXTRA_MEAT_PRICE[meat];
  const extraLabel = extraMeatLabel(meat);
  const maxExtra = EXTRA_MEAT_MAX_UNITS[weight] * qty;
  const total = price * qty + extraPrice * extraMeatQty;

  // Cart-level gate: same rule as DishCard — even while "available" globally,
  // this qty might push the customer's cart past what's actually left.
  const menuItem = menuItemById(menuId);
  const addResult = menuItem
    ? canAddToCart({
        item: menuItem,
        cfg: availabilityCfg,
        cartItems,
        requestedVariant: unitLabel,
        requestedQty: qty,
      })
    : { canAdd: true as const };
  const disabled = unavailable || !addResult.canAdd;
  const disabledReason = unavailable ? "Unavailable" : !addResult.canAdd ? addResult.reason : undefined;

  // Proactive ceiling for the qty stepper — caps how high "+" can go instead
  // of reactively disabling both buttons once qty overshoots. This is what
  // lets "−" always work: it's never touched by the cart-limit check.
  const maxQty = menuItem
    ? Math.min(20, maxAddableQty({ item: menuItem, cfg: availabilityCfg, cartItems, requestedVariant: unitLabel }))
    : 20;

  // Adds the biryani line and, when extraQty > 0, the linked extra-meat add-on
  // line. The add-on carries isAddon and is bound to this biryani by
  // reconcileExtraMeatLines, so it clamps/drops with its parent.
  const addToCart = (extraQty: number) => {
    add({
      menuId: `biryani-${meat}`,
      name: meat === "chicken" ? "Chicken Biryani" : "Mutton Biryani",
      emoji: meat === "chicken" ? "🍗" : "🥘",
      price,
      quantity: qty,
      variant: unitLabel,
    });
    if (extraQty > 0) {
      add({
        menuId: extraMeatMenuId(meat),
        name: extraLabel,
        emoji: meat === "chicken" ? "🍗" : "🥘",
        price: extraPrice,
        quantity: extraQty,
        isAddon: true,
      });
    }
    setExtraMeatQty(0);
  };

  // "Add to cart" opens the extra-meat popup for the biryani being added; the
  // popup is pre-seeded with any inline selection and does the actual add.
  const handleAdd = () => setShowExtraModal(true);

  const handleConfirmExtra = (extraQty: number) => {
    setShowExtraModal(false);
    addToCart(extraQty);
  };

  return (
    <div className="card overflow-hidden">
      <div className="grid sm:grid-cols-2">
        {/* Meat selector */}
        <div className="space-y-4 p-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-soft">Choose your meat</p>
            <div className="grid grid-cols-2 gap-2">
              {MEATS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setMeat(m.key);
                    // Switching meat changes menuId/config entirely — clamp
                    // qty to the new item's own headroom.
                    const newMenuItem = menuItemById(`biryani-${m.key}`);
                    const newCfg = configs[`biryani-${m.key}`];
                    const newAvailabilityCfg = {
                      orderedQty: newCfg?.orderedQty ?? 0,
                      limit: newCfg?.limit ?? DEFAULT_ITEM_LIMIT,
                      manualOverride: newCfg?.manualOverride ?? null,
                    };
                    const newMax = newMenuItem
                      ? Math.min(
                          20,
                          maxAddableQty({
                            item: newMenuItem,
                            cfg: newAvailabilityCfg,
                            cartItems,
                            requestedVariant: biryaniVariantLabel(weight, m.key),
                          }),
                        )
                      : 20;
                    setQty((q) => Math.max(1, Math.min(q, newMax)));
                  }}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${meat === m.key
                      ? "border-chili bg-chili/5 text-chilidark"
                      : "border-line bg-paper text-soft hover:border-soft"
                    }`}
                >
                  <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-ink/10" aria-hidden>
                    <Image src={m.photo} alt="" fill sizes="36px" className="object-cover" />
                  </span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Weight selector */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-soft">Quantity</p>
            <div className="grid grid-cols-4 gap-2">
              {WEIGHTS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => {
                    setWeight(w);
                    // Headroom depends on per-unit weight, which just changed —
                    // clamp qty down immediately rather than leaving a stale
                    // over-limit number on screen (the render-time `max` on
                    // the stepper would also catch this, but proactively
                    // snapping down avoids several extra "−" clicks).
                    const newMax = menuItem
                      ? Math.min(
                          20,
                          maxAddableQty({
                            item: menuItem,
                            cfg: availabilityCfg,
                            cartItems,
                            requestedVariant: biryaniVariantLabel(w, meat),
                          }),
                        )
                      : 20;
                    setQty((q) => Math.max(1, Math.min(q, newMax)));
                    setExtraMeatQty((q) => Math.min(q, EXTRA_MEAT_MAX_UNITS[w]));
                  }}
                  className={`rounded-xl border-2 py-3 text-sm font-bold transition ${weight === w
                      ? "border-chili bg-chili text-cream"
                      : "border-line bg-paper text-soft hover:border-soft"
                    }`}
                >
                  {w === 0.5 ? "½" : w} kg
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Price + ratio panel */}
        <div className="flex flex-col justify-between gap-4 border-t border-line bg-cream/40 p-5 sm:border-l sm:border-t-0">
          <div>
            <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-xl ring-1 ring-ink/10">
              <Image
                src={meat === "chicken" ? MEATS[0].photo : MEATS[1].photo}
                alt={meat === "chicken" ? "Chicken biryani" : "Mutton biryani"}
                fill
                sizes="(min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
              <span
                className="absolute left-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-chilidark shadow-card"
              >
                {meat === "chicken" ? "🍗 Chicken" : "🥘 Mutton"}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-display text-sm font-semibold text-soft">Price · {unitLabel}</p>
              <p className="font-display text-2xl font-bold text-chilidark">{formatINR(price)}</p>
            </div>
            <p className="mt-0.5 text-xs text-soft">Per quantity you order</p>

            <div className="mt-4 rounded-xl border border-line bg-paper p-4 text-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-soft">
                Farm-to-pot ratio for {weight === 0.5 ? "½" : weight} kg
              </p>
              <div className="flex justify-between gap-2">
                <span>Uncooked rice</span>
                <span className="font-bold">{ratio.rice}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>{meat === "chicken" ? "Chicken" : "Mutton"}</span>
                <span className="font-bold">{ratio.meat}</span>
              </div>
              <p className="mt-2 text-xs text-soft">
                Cooked slow, Nati-style, over a proper flame.
              </p>
            </div>

            {/* Extra meat add-on: e.g. "Add more 250 g chicken for 1 kg biryani" */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2.5">
              <p className="text-sm font-semibold text-ink">
                Add more {EXTRA_MEAT_GRAMS} g {meat} for {unitLabel.split(" · ")[0]} biryani
                <span className="ml-1 font-normal text-soft">· {formatINR(extraPrice)} each</span>
              </p>
              <QtyStepper
                value={extraMeatQty}
                onChange={setExtraMeatQty}
                min={0}
                max={maxExtra}
                labelFor={extraLabel}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <QtyStepper
              value={qty}
              onChange={(q) => {
                setQty(q);
                setExtraMeatQty((eq) => Math.min(eq, EXTRA_MEAT_MAX_UNITS[weight] * q));
              }}
              max={maxQty}
              labelFor="biryani parcels"
              // Only a genuinely non-interactive state (globally unavailable)
              // fully disables the stepper. Cart-limit headroom is expressed
              // via `max` above, so it can only ever stop "+" — "−" stays
              // clickable all the way down to `min`, never trapping the user.
              disabled={unavailable}
            />
            <button
              onClick={handleAdd}
              disabled={disabled}
              className="btn btn-chili flex-1 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Add ${qty} ${meat} biryani ${unitLabel} to cart`}
              title={disabledReason}
            >
              <CartIcon className="h-5 w-5" />
              {unavailable ? "Unavailable" : !addResult.canAdd ? addResult.reason : `Add to cart · ${formatINR(total)}`}
            </button>
          </div>

          <p className="text-xs text-soft">
            ₹20 packaging fee per item applies. ½ kg chicken from ₹400, mutton from ₹799.
          </p>
        </div>
      </div>

      {showExtraModal && (
        <BiryaniExtraMeatModal
          meat={meat}
          weight={weight}
          biryaniQty={qty}
          initialExtraQty={extraMeatQty}
          onConfirm={handleConfirmExtra}
          onClose={() => setShowExtraModal(false)}
        />
      )}
    </div>
  );
}