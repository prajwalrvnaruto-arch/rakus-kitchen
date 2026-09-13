"use client";

import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import type { CartItem } from "@/types";
import { packagingFeeForUnits } from "./menu";

const STORAGE_KEY = "rakus-kitchen-cart-v1";

interface CartContextValue {
  items: CartItem[];
  totalUnits: number;
  itemTotal: number;
  packagingFee: number;
  grandTotal: number;
  add: (item: CartItem) => void;
  setQuantity: (menuId: string, variant: string | undefined, quantity: number) => void;
  remove: (menuId: string, variant: string | undefined) => void;
  clear: () => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  // Hydrate from localStorage once, client-side.
  useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
  }, []);

  // Persist whenever the cart changes.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable (private mode) — cart still works in-memory */
    }
  }, [items, hydrated]);

  const add = (item: CartItem) =>
    setItems((prev) => {
      const existing = prev.find((i) => i.menuId === item.menuId && i.variant === item.variant);
      if (existing) {
        return prev.map((i) =>
          i.menuId === item.menuId && i.variant === item.variant
            ? { ...i, quantity: i.quantity + item.quantity }
            : i,
        );
      }
      return [...prev, item];
    });

  // A cart line is keyed by (menuId, variant) so the same dish at different
  // weights (e.g. biryani ½kg vs 1kg) stays separate lines.
  const lineMatches = (item: CartItem, menuId: string, variant: string | undefined) =>
    item.menuId === menuId && (item.variant ?? undefined) === variant;

  const setQuantity = (menuId: string, variant: string | undefined, quantity: number) =>
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => !lineMatches(i, menuId, variant))
        : prev.map((i) => (lineMatches(i, menuId, variant) ? { ...i, quantity } : i)),
    );

  const remove = (menuId: string, variant: string | undefined) =>
    setItems((prev) => prev.filter((i) => !lineMatches(i, menuId, variant)));

  const clear = () => setItems([]);

  const value = useMemo<CartContextValue>(() => {
    const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
    const itemTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const packaging = packagingFeeForUnits(totalUnits);
    return {
      items,
      totalUnits,
      itemTotal,
      packagingFee: packaging,
      grandTotal: itemTotal + packaging,
      add,
      setQuantity,
      remove,
      clear,
      cartOpen,
      setCartOpen,
    };
  }, [items, cartOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}