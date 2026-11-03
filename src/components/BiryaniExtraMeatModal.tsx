"use client";

import { useEffect, useRef, useState } from "react";
import type { BiryaniMeat, BiryaniWeight } from "@/types";
import {
  EXTRA_MEAT_GRAMS, EXTRA_MEAT_PRICE, EXTRA_MEAT_MAX_UNITS, formatINR,
} from "@/lib/menu";
import { QtyStepper } from "./QtyStepper";

interface BiryaniExtraMeatModalProps {
  /** Which biryani the popup is riding on. */
  meat: BiryaniMeat;
  weight: BiryaniWeight;
  /** Number of biryani parcels being added — caps the extra-meat allowance. */
  biryaniQty: number;
  /** Pre-seeded from the inline selector, so opening the popup doesn't lose it. */
  initialExtraQty: number;
  /** Confirm with the chosen extra-meat quantity (0 = none). */
  onConfirm: (extraQty: number) => void;
  /** Dismiss without adding (Escape, backdrop, or close button). */
  onClose: () => void;
}

/**
 * Interstitial popup shown when a customer adds a biryani to the cart, offering
 * extra meat (chicken or mutton, matching the biryani) for that specific item.
 * Whatever the customer picks here is handed back via onConfirm so BiryaniPicker
 * can add the biryani line and, when extraQty > 0, the linked add-on line — the
 * add-on stays wired to this biryani through reconcileExtraMeatLines.
 */
export function BiryaniExtraMeatModal({
  meat, weight, biryaniQty, initialExtraQty, onConfirm, onClose,
}: BiryaniExtraMeatModalProps) {
  const meatLabel = meat === "chicken" ? "chicken" : "mutton";
  const maxExtra = EXTRA_MEAT_MAX_UNITS[weight] * biryaniQty;
  const [extraQty, setExtraQty] = useState(() => Math.min(initialExtraQty, maxExtra));
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Close on Escape; move focus to the primary action on open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const extraPrice = EXTRA_MEAT_PRICE[meat];
  const extraTotal = extraPrice * extraQty;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="extra-meat-title"
    >
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div className="relative m-0 w-full max-w-md rounded-t-2xl bg-paper p-5 shadow-lift sm:m-4 sm:rounded-2xl">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 id="extra-meat-title" className="font-display text-lg font-semibold">
            Add extra {meatLabel}?
          </h2>
          <button
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-full p-2 text-soft transition hover:bg-creamdark"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-soft">
          Want more {meatLabel} in your biryani? Add {EXTRA_MEAT_GRAMS} g portions
          on top of the included ratio — {formatINR(extraPrice)} each.
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-cream/40 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              Extra {meatLabel} ({EXTRA_MEAT_GRAMS} g)
            </p>
            <p className="text-xs text-soft">
              {extraQty > 0 ? formatINR(extraTotal) : `Up to ${maxExtra} for this order`}
            </p>
          </div>
          <QtyStepper
            value={extraQty}
            onChange={setExtraQty}
            min={0}
            max={maxExtra}
            labelFor={`extra ${meatLabel}`}
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => onConfirm(0)}
            className="btn btn-ghost flex-1"
          >
            No thanks
          </button>
          <button
            ref={confirmRef}
            onClick={() => onConfirm(extraQty)}
            className="btn btn-chili flex-1"
          >
            {extraQty > 0
              ? `Add · ${formatINR(extraTotal)} extra`
              : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
