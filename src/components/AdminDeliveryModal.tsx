"use client";

import { useEffect } from "react";

export type DeliveryCarrier = "borzo" | "porter" | "general";

export type DeliveryModalState =
  | {
      type: "confirm";
      carrier: "borzo";
      orderId: string;
      customerName: string;
      customerPhone: string;
      dropAddress: string;
      fareEstimate?: number;
      onConfirm: () => void | Promise<void>;
      isBusy?: boolean;
    }
  | {
      type: "error";
      carrier: DeliveryCarrier;
      title?: string;
      message: string;
      orderId?: string;
      onRetry?: () => void | Promise<void>;
    }
  | {
      type: "success";
      carrier: DeliveryCarrier;
      orderId: string;
      carrierOrderId?: string;
      fareEstimate?: number;
      trackingUrl?: string;
      mock?: boolean;
    }
  | {
      type: "notice";
      title: string;
      message: string;
      orderId?: string;
    };

interface AdminDeliveryModalProps {
  modal: DeliveryModalState | null;
  onClose: () => void;
}

const CARRIER_LABELS: Record<DeliveryCarrier, string> = {
  borzo: "Borzo",
  porter: "Porter",
  general: "Delivery",
};

export function AdminDeliveryModal({ modal, onClose }: AdminDeliveryModalProps) {
  useEffect(() => {
    if (!modal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modal.type === "confirm" && modal.isBusy) return;
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal, onClose]);

  if (!modal) return null;

  const carrier = "carrier" in modal ? modal.carrier : "general";
  const carrierName = CARRIER_LABELS[carrier] || "Delivery";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inkdark/80 p-3 sm:p-4 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (modal.type === "confirm" && modal.isBusy) return;
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border-2 border-line bg-paper shadow-2xl animate-scale-up">
        {/* ── MODAL: CONFIRM DISPATCH ── */}
        {modal.type === "confirm" && (
          <>
            <header className="flex items-center justify-between border-b border-line bg-cream px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-turmeric/20 text-lg">
                  🛵
                </span>
                <div>
                  <h3 className="font-display text-base font-bold text-ink">
                    Confirm {carrierName} Dispatch
                  </h3>
                  <p className="text-xs text-soft">1-Click Automated Delivery Booking</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={modal.isBusy}
                className="rounded-lg p-1 text-soft hover:bg-creamdark hover:text-ink disabled:opacity-40 transition"
                aria-label="Close modal"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-line bg-cream/30 p-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-soft">
                  Order ID
                </span>
                <span className="font-mono font-bold text-ink">{modal.orderId}</span>
              </div>

              <div className="space-y-1 rounded-xl border border-line/70 bg-paper p-3 text-xs">
                <p className="font-semibold text-soft uppercase tracking-wider">Customer Details</p>
                <p className="text-sm font-bold text-ink">{modal.customerName}</p>
                <p className="font-mono text-soft">{modal.customerPhone}</p>
              </div>

              <div className="space-y-1 rounded-xl border border-line/70 bg-paper p-3 text-xs">
                <div className="flex items-center gap-1 font-semibold text-soft uppercase tracking-wider">
                  <span>📍</span>
                  <span>Delivery Address</span>
                </div>
                <p className="text-xs text-ink leading-relaxed break-words">{modal.dropAddress}</p>
              </div>

              {modal.fareEstimate !== undefined && (
                <div className="flex items-center justify-between rounded-xl border border-ok/30 bg-ok/5 p-3 text-xs">
                  <span className="font-semibold text-soft">Estimated Carrier Fare</span>
                  <span className="font-bold text-ok">₹{modal.fareEstimate}</span>
                </div>
              )}

              <p className="text-[11px] text-soft leading-relaxed">
                Dispatching will automatically send pickup details to {carrierName} with the kitchen
                address and update this order status to <strong className="text-ink">Out for Delivery</strong>.
              </p>
            </div>

            <footer className="flex items-center justify-end gap-2.5 border-t border-line bg-cream/40 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                disabled={modal.isBusy}
                className="btn btn-ghost px-4 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={modal.onConfirm}
                disabled={modal.isBusy}
                className="btn px-5 py-2 text-xs font-bold shadow-sm bg-turmeric text-inkdark hover:bg-turmeric/80 disabled:opacity-50"
              >
                {modal.isBusy ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Booking Rider...
                  </span>
                ) : (
                  `⚡ Book via ${carrierName}`
                )}
              </button>
            </footer>
          </>
        )}

        {/* ── MODAL: ERROR NOTIFICATION ── */}
        {modal.type === "error" && (
          <>
            <header className="flex items-center justify-between border-b border-chili/20 bg-chili/10 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chili/20 text-lg">
                  ⚠️
                </span>
                <div>
                  <h3 className="font-display text-base font-bold text-chili">
                    {modal.title || `${carrierName} Booking Failed`}
                  </h3>
                  {modal.orderId && (
                    <p className="text-xs text-soft font-mono">Order {modal.orderId}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-soft hover:bg-chili/10 hover:text-chili transition"
                aria-label="Close modal"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm">
              <div className="rounded-2xl border-2 border-chili/30 bg-chili/5 p-4 text-xs space-y-1.5">
                <p className="font-bold uppercase tracking-wider text-chilidark">Error Details</p>
                <p className="text-ink leading-relaxed break-words font-medium">
                  {modal.message}
                </p>
              </div>

              <div className="rounded-xl border border-line bg-cream/30 p-3 text-xs space-y-1 text-soft">
                <p className="font-bold text-ink">Suggested Next Steps:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                  <li>Verify customer phone number has 10 valid digits.</li>
                  <li>Confirm drop address details and landmark.</li>
                  <li>You can switch to Porter (1-Tap Paste) or call the customer directly.</li>
                </ul>
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2.5 border-t border-line bg-cream/40 px-5 py-3">
              {modal.onRetry && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    modal.onRetry?.();
                  }}
                  className="btn btn-chili px-4 py-2 text-xs font-bold"
                >
                  Retry Booking
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost px-4 py-2 text-xs"
              >
                Dismiss
              </button>
            </footer>
          </>
        )}

        {/* ── MODAL: SUCCESS NOTIFICATION ── */}
        {modal.type === "success" && (
          <>
            <header className="flex items-center justify-between border-b border-ok/20 bg-ok/10 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ok/20 text-lg">
                  ✅
                </span>
                <div>
                  <h3 className="font-display text-base font-bold text-ok">
                    {carrierName} Delivery Booked
                  </h3>
                  <p className="text-xs text-soft font-mono">Order {modal.orderId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-soft hover:bg-ok/10 hover:text-ok transition"
                aria-label="Close modal"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 text-sm">
              {modal.mock && (
                <div className="rounded-xl border border-turmeric/50 bg-turmeric/10 p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-ink">
                    <span>🧪</span>
                    <span>MOCK MODE (Simulation)</span>
                  </div>
                  <p className="mt-1 text-soft leading-relaxed text-[11px]">
                    This is a simulated ride for testing. To book real riders, configure{" "}
                    <code className="rounded bg-cream px-1 font-mono font-bold text-ink">
                      BORZO_API_KEY
                    </code>{" "}
                    in your environment settings.
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-line bg-paper p-3 text-xs space-y-2">
                {modal.carrierOrderId && (
                  <div className="flex items-center justify-between">
                    <span className="text-soft font-semibold">Carrier Order ID:</span>
                    <span className="font-mono font-bold text-ink">{modal.carrierOrderId}</span>
                  </div>
                )}
                {modal.fareEstimate !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-soft font-semibold">Fare Estimate:</span>
                    <span className="font-bold text-ok">₹{modal.fareEstimate} (COD to driver)</span>
                  </div>
                )}
              </div>

              {modal.trackingUrl && (
                <a
                  href={modal.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-chilidark/40 bg-chili/5 px-4 py-2.5 text-xs font-bold text-chilidark hover:bg-chili/10 transition"
                >
                  <span>📍 Track Rider in Real-Time ↗</span>
                </a>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2.5 border-t border-line bg-cream/40 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-turmeric px-5 py-2 text-xs font-bold"
              >
                Done
              </button>
            </footer>
          </>
        )}

        {/* ── MODAL: NOTICE / CLIPBOARD / GENERAL ── */}
        {modal.type === "notice" && (
          <>
            <header className="flex items-center justify-between border-b border-line bg-cream px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-turmeric/20 text-lg">
                  📋
                </span>
                <div>
                  <h3 className="font-display text-base font-bold text-ink">{modal.title}</h3>
                  {modal.orderId && (
                    <p className="text-xs text-soft font-mono">Order {modal.orderId}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-soft hover:bg-creamdark hover:text-ink transition"
                aria-label="Close modal"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4 text-xs text-ink leading-relaxed break-words whitespace-pre-line">
              {modal.message}
            </div>

            <footer className="flex items-center justify-end gap-2.5 border-t border-line bg-cream/40 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost px-5 py-2 text-xs font-bold"
              >
                Okay
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
