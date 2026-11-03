"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { retryingListener } from "./db";
import type { MenuItemConfig } from "./menuLimits";

interface MenuAvailabilityContextValue {
  /** Keyed by menuId. Missing key = no config doc yet = untracked/available. */
  configs: Record<string, MenuItemConfig>;
  loading: boolean;
}

const MenuAvailabilityContext = createContext<MenuAvailabilityContextValue | null>(null);

/**
 * Live subscription to the menuConfig collection (public read — see
 * firestore.rules), so every dish card / biryani picker on the site reflects
 * an admin's limit/override/reset changes without a page reload. Wrapped in
 * retryingListener (from db.ts) for the same resilience subscribeAllOrders
 * gets — a transient listen error recovers on its own instead of leaving
 * availability stuck.
 */
export function MenuAvailabilityProvider({ children }: { children: ReactNode }) {
  const [configs, setConfigs] = useState<Record<string, MenuItemConfig>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const firestore = db;
    const unsubscribe = retryingListener("subscribeMenuConfig", (onSnapshotError) =>
      onSnapshot(
        collection(firestore, "menuConfig"),
        (snap) => {
          const next: Record<string, MenuItemConfig> = {};
          snap.docs.forEach((d) => {
            next[d.id] = d.data() as MenuItemConfig;
          });
          setConfigs(next);
          setLoading(false);
        },
        onSnapshotError,
      ),
    );
    return unsubscribe;
  }, []);

  const value = useMemo<MenuAvailabilityContextValue>(() => ({ configs, loading }), [configs, loading]);

  return <MenuAvailabilityContext.Provider value={value}>{children}</MenuAvailabilityContext.Provider>;
}

export function useMenuAvailability(): MenuAvailabilityContextValue {
  const ctx = useContext(MenuAvailabilityContext);
  if (!ctx) throw new Error("useMenuAvailability must be used inside <MenuAvailabilityProvider>");
  return ctx;
}
