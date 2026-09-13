"use client";

import { useState } from "react";
import Image from "next/image";
import type { BiryaniMeat, BiryaniWeight } from "@/types";
import { BIRYANI_PRICING, BIRYANI_RATIO, biryaniVariantLabel, formatINR } from "@/lib/menu";
import { useCart } from "@/lib/cart-context";
import { QtyStepper } from "./QtyStepper";
import { CartIcon } from "./icons";

const WEIGHTS: BiryaniWeight[] = [0.5, 1, 2, 3];
const MEATS: { key: BiryaniMeat; label: string; photo: string }[] = [
  { key: "chicken", label: "Chicken", photo: "/images/dishes/biryani-chicken.webp" },
  { key: "mutton", label: "Mutton", photo: "/images/dishes/biryani-mutton.webp" },
];

export function BiryaniPicker() {
  const { add } = useCart();
  const [meat, setMeat] = useState<BiryaniMeat>("chicken");
  const [weight, setWeight] = useState<BiryaniWeight>(1);
  const [qty, setQty] = useState(1);

  const price = BIRYANI_PRICING[weight][meat];
  const ratio = BIRYANI_RATIO[weight];
  const unitLabel = biryaniVariantLabel(weight, meat);

  const handleAdd = () => {
    add({
      menuId: `biryani-${meat}`,
      name: meat === "chicken" ? "Chicken Biryani" : "Mutton Biryani",
      emoji: meat === "chicken" ? "🍗" : "🥘",
      price,
      quantity: qty,
      variant: unitLabel,
    });
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
                  onClick={() => setMeat(m.key)}
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
                  onClick={() => setWeight(w)}
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <QtyStepper value={qty} onChange={setQty} labelFor="biryani parcels" />
            <button
              onClick={handleAdd}
              className="btn btn-chili flex-1"
              aria-label={`Add ${qty} ${meat} biryani ${unitLabel} to cart`}
            >
              <CartIcon className="h-5 w-5" />
              Add to cart · {formatINR(price * qty)}
            </button>
          </div>
          <p className="text-xs text-soft">
            ₹20 packaging fee per item applies. ½ kg chicken from ₹400, mutton from ₹800.
          </p>
        </div>
      </div>
    </div>
  );
}