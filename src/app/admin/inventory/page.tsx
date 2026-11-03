"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminGate } from "@/components/AdminGate";
import { subscribeMenuConfig, setMenuItemLimit, setMenuItemAvailabilityOverride, resetMenuItemOrderedQty, resetAllMenuItemOrderedQty, type MenuConfigWithId } from "@/lib/db";
import { MENU } from "@/lib/menu";
import { itemHasQuantityLimit, limitUnitLabel, deriveAvailability, DEFAULT_ITEM_LIMIT, type ManualOverride } from "@/lib/menuLimits";
import { formatINR } from "@/lib/menu";

import { AdminDeliveryModal, type DeliveryModalState } from "@/components/AdminDeliveryModal";

export default function InventoryPage() {
  return (
    <AdminGate>
      <InventoryContent />
    </AdminGate>
  );
}

function InventoryContent() {
  const [configs, setConfigs] = useState<MenuConfigWithId[] | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<DeliveryModalState | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeMenuConfig(
      (data) => {
        setConfigError(null);
        setConfigs(data);
      },
      (message) => setConfigError(message),
    );
    return unsubscribe;
  }, []);

  const handleLimitChange = async (menuId: string, limit: number) => {
    if (limit < 0 || !Number.isInteger(limit)) return;
    setBusy((prev) => ({ ...prev, [menuId]: true }));
    try {
      await setMenuItemLimit(menuId, limit);
    } catch (err) {
      setModal({
        type: "error",
        carrier: "general",
        title: "Failed to Update Limit",
        message: (err as Error).message,
      });
    } finally {
      setBusy((prev) => ({ ...prev, [menuId]: false }));
    }
  };

  const handleOverrideChange = async (menuId: string, override: ManualOverride) => {
    setBusy((prev) => ({ ...prev, [menuId]: true }));
    try {
      await setMenuItemAvailabilityOverride(menuId, override);
    } catch (err) {
      setModal({
        type: "error",
        carrier: "general",
        title: "Failed to Update Override",
        message: (err as Error).message,
      });
    } finally {
      setBusy((prev) => ({ ...prev, [menuId]: false }));
    }
  };

  const executeReset = async (menuId: string) => {
    setBusy((prev) => ({ ...prev, [menuId]: true }));
    try {
      await resetMenuItemOrderedQty(menuId);
      setModal(null);
    } catch (err) {
      setModal({
        type: "error",
        carrier: "general",
        title: "Failed to Reset Quantity",
        message: (err as Error).message,
      });
    } finally {
      setBusy((prev) => ({ ...prev, [menuId]: false }));
    }
  };

  const handleReset = (menuId: string) => {
    const item = MENU.find((m) => m.id === menuId);
    setModal({
      type: "confirm",
      carrier: "borzo",
      orderId: item?.name ?? menuId,
      customerName: "Reset Ordered Quantity",
      customerPhone: "Action will reset count to 0",
      dropAddress: `Reset counter for ${item?.name ?? menuId} back to 0. Limit and availability will recalculate automatically.`,
      onConfirm: () => executeReset(menuId),
    });
  };

  const executeResetAll = async () => {
    const allMenuIds = MENU.map((m) => m.id);
    setBusy((prev) => ({ ...prev, resetAll: true }));
    try {
      await resetAllMenuItemOrderedQty(allMenuIds);
      setModal(null);
    } catch (err) {
      setModal({
        type: "error",
        carrier: "general",
        title: "Failed to Reset All Quantities",
        message: (err as Error).message,
      });
    } finally {
      setBusy((prev) => ({ ...prev, resetAll: false }));
    }
  };

  const handleResetAll = () => {
    setModal({
      type: "confirm",
      carrier: "borzo",
      orderId: "All Menu Items",
      customerName: "Reset All Ordered Counters",
      customerPhone: "Action cannot be undone",
      dropAddress: "This will clear the ordered quantity counter for every menu item across the kitchen.",
      onConfirm: () => executeResetAll(),
    });
  };

  // Join menu with configs — show all menu items, using default values when no Firestore doc exists yet
  const rows = MENU.map((item) => {
    const cfg = configs?.find((c) => c.menuId === item.id);
    const orderedQty = cfg?.orderedQty ?? 0;
    const limit = cfg?.limit ?? DEFAULT_ITEM_LIMIT;
    const manualOverride = cfg?.manualOverride ?? null;
    const limitEnabled = itemHasQuantityLimit(item);
    const availability = deriveAvailability({ orderedQty, limit, manualOverride });
    const remaining = limitEnabled ? Math.max(0, limit - orderedQty) : null;
    const unit = limitUnitLabel(item);

    return {
      item,
      orderedQty,
      limit,
      manualOverride,
      limitEnabled,
      availability,
      remaining,
      unit,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Item Sales &amp; Limits</h1>
          <p className="text-sm text-soft">Live order quantities and availability controls.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleResetAll}
            disabled={busy.resetAll || configs === null}
            className="btn btn-ghost px-4 py-2 text-xs"
          >
            {busy.resetAll ? "Resetting…" : "🔄 Reset All Quantities"}
          </button>
          <Link href="/admin" className="btn btn-ghost px-4 py-2 text-xs">
            ← Back to Orders
          </Link>
        </div>
      </header>

      {configError && (
        <div className="mb-4 rounded-xl border border-chili/30 bg-chili/5 px-4 py-3 text-sm text-chili">
          Failed to load config: {configError}
        </div>
      )}

      {configs === null && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-24 animate-pulse bg-cream/60 p-5" />
          ))}
        </div>
      )}

      {configs !== null && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-line bg-cream/40">
                <th className="px-3 py-2.5 text-left font-semibold">Item</th>
                <th className="px-3 py-2.5 text-right font-semibold">Ordered</th>
                <th className="px-3 py-2.5 text-right font-semibold">Limit</th>
                <th className="px-3 py-2.5 text-right font-semibold">Remaining</th>
                <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                <th className="px-3 py-2.5 text-center font-semibold">Override</th>
                <th className="px-3 py-2.5 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.item.id} className="border-b border-line/60 hover:bg-cream/20">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden>{row.item.emoji}</span>
                      <div>
                        <p className="font-semibold">{row.item.name}</p>
                        <p className="text-xs text-soft">
                          {row.item.category}
                          {row.limitEnabled ? "" : " · Unlimited"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <span className="font-semibold">{row.orderedQty}</span>
                    <span className="ml-1 text-xs text-soft">{row.unit}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.limitEnabled ? (
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.limit}
                        onChange={(e) => {
                          const val = Number.parseInt(e.target.value, 10);
                          if (!Number.isNaN(val)) handleLimitChange(row.item.id, val);
                        }}
                        disabled={busy[row.item.id]}
                        className="field w-20 px-2 py-1 text-right text-sm tabular-nums"
                      />
                    ) : (
                      <span className="text-soft">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {row.remaining !== null ? (
                      <span className={row.remaining === 0 ? "font-bold text-chili" : ""}>
                        {row.remaining}
                        <span className="ml-1 text-xs text-soft">{row.unit}</span>
                      </span>
                    ) : (
                      <span className="text-soft">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {row.limitEnabled ? (
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                          row.availability === "available"
                            ? "bg-ok/15 text-ok"
                            : "bg-chili/10 text-chili"
                        }`}
                      >
                        {row.availability === "available" ? "Available" : "Unavailable"}
                      </span>
                    ) : (
                      <span className="text-xs text-soft">Always on</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {row.limitEnabled ? (
                      <select
                        value={row.manualOverride ?? "auto"}
                        onChange={(e) => {
                          const val = e.target.value === "auto" ? null : e.target.value as ManualOverride;
                          handleOverrideChange(row.item.id, val);
                        }}
                        disabled={busy[row.item.id]}
                        className="field px-2 py-1 text-xs"
                      >
                        <option value="auto">Auto</option>
                        <option value="available">Force Available</option>
                        <option value="unavailable">Force Unavailable</option>
                      </select>
                    ) : (
                      <span className="text-soft">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => handleReset(row.item.id)}
                      disabled={busy[row.item.id] || row.orderedQty === 0}
                      className="btn btn-ghost px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-line bg-cream/30 p-4 text-sm text-soft">
        <p className="font-semibold text-ink">How it works:</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li><span className="font-semibold">Ordered:</span> Total quantity sold today (cumulative, never decrements).</li>
          <li><span className="font-semibold">Limit:</span> Maximum quantity before the item becomes unavailable (editable for non-veg items only).</li>
          <li><span className="font-semibold">Remaining:</span> How much is left before the limit is reached.</li>
          <li><span className="font-semibold">Status:</span> Availability shown to customers (auto-derived unless overridden).</li>
          <li><span className="font-semibold">Override:</span> Force an item available or unavailable regardless of its ordered quantity.</li>
          <li><span className="font-semibold">Reset:</span> Zero out the ordered quantity counter (manual action only, no automatic resets).</li>
        </ul>
      </div>

      {/* Raku's Kitchen Styled Admin Modal */}
      <AdminDeliveryModal modal={modal} onClose={() => setModal(null)} />
    </div>
  );
}
