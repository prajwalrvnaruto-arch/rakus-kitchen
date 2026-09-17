"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { formatINR, menuItemById } from "@/lib/menu";
import { CartIcon, EmptyPlateIcon, DishPlaceholderIcon } from "./icons";

export function CartDrawer() {
  const { items, itemTotal, packagingFee, grandTotal, cartOpen, setCartOpen, setQuantity, remove } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [cartOpen, setCartOpen]);

  if (!cartOpen) return null;

  const goCheckout = () => {
    setCartOpen(false);
    router.push(user ? "/checkout" : "/login");
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Your cart">
      <div className="absolute inset-0 bg-ink/40" onClick={() => setCartOpen(false)} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-paper shadow-lift">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Your cart</h2>
          <button
            onClick={() => setCartOpen(false)}
            className="rounded-full p-2 text-soft transition hover:bg-creamdark"
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="text-soft/60" aria-hidden>
              <EmptyPlateIcon className="h-14 w-14" />
            </span>
            <p className="font-semibold">Your cart is empty</p>
            <p className="text-sm text-soft">Add something delicious from our menu.</p>
            <Link
              href="/menu"
              onClick={() => setCartOpen(false)}
              className="btn btn-chili mt-2"
            >
              Browse menu
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line/60 overflow-y-auto px-5">
              {items.map((item) => {
                const photo = menuItemById(item.menuId)?.photo;
                return (
                  <li key={`${item.menuId}-${item.variant ?? ""}`} className="flex items-start gap-3 py-4">
                    {photo ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-ink/10">
                        <Image src={photo} alt={item.name} fill sizes="48px" className="object-cover" />
                      </div>
                    ) : (
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-creamdark text-soft/50" aria-hidden>
                        <DishPlaceholderIcon className="h-5 w-5" />
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                    <p className="font-semibold leading-tight">{item.name}</p>
                    {item.variant && <p className="text-xs font-medium text-soft">{item.variant}</p>}
                    <p className="mt-0.5 text-sm text-soft">
                      {formatINR(item.price)} {item.quantity > 1 && `× ${item.quantity}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2 rounded-full border border-line px-1.5 py-0.5">
                      <button
                        onClick={() => setQuantity(item.menuId, item.variant, item.quantity - 1)}
                        className="grid h-7 w-7 place-items-center rounded-full text-soft hover:bg-creamdark"
                        aria-label={`Decrease ${item.name}`}
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                      <button
                        onClick={() => setQuantity(item.menuId, item.variant, item.quantity + 1)}
                        className="grid h-7 w-7 place-items-center rounded-full text-soft hover:bg-creamdark"
                        aria-label={`Increase ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => remove(item.menuId, item.variant)}
                      className="text-xs font-semibold text-chili/70 hover:text-chili"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
              })}
            </ul>

            <div className="space-y-1 border-t border-line px-5 py-4 text-sm">
              <div className="flex justify-between text-soft">
                <span>Items</span>
                <span>{formatINR(itemTotal)}</span>
              </div>
              <div className="flex justify-between text-soft">
                <span>Packaging (₹20/item)</span>
                <span>{formatINR(packagingFee)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-bold">
                <span>Total</span>
                <span>{formatINR(grandTotal)}</span>
              </div>
              <p className="pt-1 text-xs text-soft">
                Delivery charges are paid by the customer to the delivery partner.
              </p>
              <button onClick={goCheckout} className="btn btn-chili w-full">
                <CartIcon className="h-5 w-5" />
                {user ? "Proceed to checkout" : "Log in to checkout"}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}