"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { MenuItem } from "@/types";
import { formatINR } from "@/lib/menu";
import { useCart } from "@/lib/cart-context";
import { QtyStepper } from "./QtyStepper";
import { CartIcon } from "./icons";

export function DishCard({ item }: { item: MenuItem }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  // Default to the first (lightest/cheapest) variant when the dish has portions.
  const [variant, setVariant] = useState(item.variants?.[0]?.label ?? "");
  const [variantPrice, setVariantPrice] = useState(item.variants?.[0]?.price ?? 0);

  const isBiryani = item.category === "Biryani";
  const hasVariants = !!item.variants?.length;
  // When portions are enabled the selected variant's price overrides `item.price`.
  // All non-variant items define a price; the ?? fallback only guards an authoring slip.
  const unitPrice = hasVariants ? variantPrice : item.price ?? 0;

  const handleAdd = () => {
    add({
      menuId: item.id,
      name: item.name,
      emoji: item.emoji,
      price: unitPrice,
      quantity: qty,
      // Portion label (e.g. "½ kg"). The cart keys a line by (menuId, variant),
      // so "½ kg" on two different dishes still resolves to the right line.
      ...(hasVariants ? { variant } : {}),
    });
    setQty(1);
  };

  return (
    <div className="card group flex items-stretch gap-3.5 p-3">
      {item.photo ? (
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl ring-1 ring-ink/10 sm:h-28 sm:w-28">
          <Image
            src={item.photo}
            alt={item.name}
            fill
            sizes="112px"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
          <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-cream/40" aria-hidden />
        </div>
      ) : (
        <div
          className={`grid h-24 w-24 shrink-0 place-items-center rounded-xl text-4xl sm:h-28 sm:w-28 ${isBiryani
              ? "bg-gradient-to-br from-turmeric/25 to-chili/20"
              : item.veg
                ? "bg-gradient-to-br from-ok/15 to-greenburn/10"
                : "bg-gradient-to-br from-turmeric/25 to-chili/25"
            }`}
          aria-hidden
        >
          {item.emoji}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-snug">{item.name}</p>
            {item.unit && <p className="text-xs text-soft">{item.unit}</p>}
          </div>
          {item.veg && <span className="chip shrink-0" title="Vegetarian">🟢 Veg</span>}
        </div>

        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-soft">{item.description}</p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          {isBiryani ? (
            <>
              <p className="text-sm font-bold text-chilidark">From {formatINR(400)}</p>
              <Link href="/biryani" className="btn btn-chili px-4 py-1.5 text-xs">
                Pick weight
              </Link>
            </>
          ) : hasVariants ? (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold text-chilidark">{formatINR(unitPrice)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.variants!.map((v) => (
                    <button
                      key={v.label}
                      onClick={() => {
                        setVariant(v.label);
                        setVariantPrice(v.price);
                      }}
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                        variant === v.label
                          ? "border-chili bg-chili/10 text-chilidark"
                          : "border-ink/15 text-soft hover:border-chili/40"
                      }`}
                      aria-pressed={variant === v.label}
                    >
                      {formatINR(v.price)} · {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <QtyStepper value={qty} onChange={setQty} labelFor={item.name} />
                <button
                  onClick={handleAdd}
                  className="btn btn-chili px-3.5 py-2 text-xs"
                  aria-label={`Add ${qty} ${variant} ${item.name} to cart`}
                >
                  <CartIcon className="h-4 w-4" /> Add
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-bold">{formatINR(item.price ?? 0)}</p>
              <div className="flex items-center gap-1.5">
                <QtyStepper value={qty} onChange={setQty} labelFor={item.name} />
                <button
                  onClick={handleAdd}
                  className="btn btn-chili px-3.5 py-2 text-xs"
                  aria-label={`Add ${qty} ${item.name} to cart`}
                >
                  <CartIcon className="h-4 w-4" /> Add
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}