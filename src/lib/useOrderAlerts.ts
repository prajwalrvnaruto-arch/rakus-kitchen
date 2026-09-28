"use client";

/**
 * useOrderAlerts — kitchen new-order alert controller.
 *
 * Owns everything the kitchen admin needs to *never miss* a new order:
 *   - armed:      an audio context (needs one user gesture to unlock),
 *                 OS notification permission, and vibration ready
 *   - queue:      orders that arrived live and haven't been acknowledged
 *   - loop:       while the queue is non-empty →
 *                   · a looping Web Audio buzzer (no external asset)
 *                   · navigator.vibrate on each buzz (mobile)
 *                   · document.title flash ("🔔 NEW ORDER (n)")
 *                   · one OS notification per new order (when backgrounded)
 *   - muted:      admin can silence sound while the banner stays up
 *   - acknowledge: clears the queue and stops everything
 *
 * Design constraints:
 *   - Browsers block audio autoplay until a user gesture. The `arm()` function
 *     must be called inside a click handler — it creates/resumes an AudioContext
 *     and requests permissions there. After that, alerts fire automatically.
 *   - `armed` state persists in sessionStorage so a same-tab reload stays armed
 *     (the AudioContext is recreated lazily on the next push).
 *   - All browser API calls are guarded (typeof + try/catch): this runs on
 *     phones with partial API support and in server-side render contexts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Order } from "@/types";

const SESSION_KEY = "rk-alerts-armed-v1";

export interface OrderAlertsHook {
  /** True after the admin tapped "Enable alerts". Sound/vibration ready. */
  armed: boolean;
  /** Orders waiting for acknowledgement (arrival order, oldest first). */
  queue: Order[];
  /** Whether sound is muted (banner stays; just no audio). */
  muted: boolean;
  /** Arm alerts: call inside a click handler. Resolves AudioContext,
   *  requests Notification + vibration permissions. */
  arm: () => Promise<void>;
  /** Push genuinely-new orders into the alert queue. */
  pushNew: (orders: Order[]) => void;
  /** Acknowledge all pending orders: clear queue, stop sound/vibration/title. */
  acknowledge: () => void;
  /** Toggle sound mute without clearing the queue. */
  toggleMute: () => void;
}

export function useOrderAlerts(): OrderAlertsHook {
  const [armed, setArmed] = useState<boolean>(() => {
    try { return !!sessionStorage.getItem(SESSION_KEY); } catch { return false; }
  });
  const [queue, setQueue] = useState<Order[]>([]);
  const [muted, setMuted] = useState(false);

  // Stable refs so interval callbacks close over the latest values.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalTitle = useRef<string>("");

  // ── Sound ─────────────────────────────────────────────────────────────── //

  const playBuzz = useCallback(() => {
    if (muted) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      // A short oscillator burst: 220 Hz → 280 Hz over 180ms, then silence.
      // Sounds like a kitchen buzzer — attention-grabbing, not a gentle chime.
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(280, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch { /* AudioContext may be suspended or unavailable */ }
  }, [muted]);

  // ── Vibration ─────────────────────────────────────────────────────────── //

  const vibrate = useCallback(() => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch { /* vibration not available */ }
  }, []);

  // ── Start / stop the alert loop ────────────────────────────────────────── //

  const stopLoop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Restore the original tab title.
    if (originalTitle.current) {
      try { document.title = originalTitle.current; } catch { /* server */ }
    }
  }, []);

  const startLoop = useCallback((count: number) => {
    stopLoop();
    if (count === 0) return;

    // Capture the real title on first alert (if the document is available).
    try {
      if (!originalTitle.current) originalTitle.current = document.title;
    } catch { /* server */ }

    let titleFlip = false;
    // Buzz + vibrate immediately, then every 2.5 s until acknowledged.
    const tick = () => {
      playBuzz();
      vibrate();
      try {
        titleFlip = !titleFlip;
        document.title = titleFlip
          ? `🔔 NEW ORDER (${count})`
          : (originalTitle.current || "Raku's Kitchen — Admin");
      } catch { /* server */ }
    };
    tick();
    intervalRef.current = setInterval(tick, 2500);
  }, [playBuzz, vibrate, stopLoop]);

  // Re-start the loop whenever the queue changes (new order added or cleared).
  useEffect(() => {
    if (queue.length > 0 && armed) {
      startLoop(queue.length);
    } else {
      stopLoop();
    }
    return () => { /* cleanup handled by stopLoop in acknowledge */ };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, armed]);

  // Cleanup on unmount (e.g. admin navigates away).
  useEffect(() => {
    return () => {
      stopLoop();
      try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    };
  }, [stopLoop]);

  // ── Public API ─────────────────────────────────────────────────────────── //

  const arm = useCallback(async () => {
    // Create or resume the AudioContext inside the user gesture.
    try {
      if (!audioCtxRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AC = (window.AudioContext ?? (window as any).webkitAudioContext) as typeof AudioContext | undefined;
        if (AC) audioCtxRef.current = new AC();
      }
      await audioCtxRef.current?.resume();
    } catch { /* AudioContext may not be available (some older mobile browsers) */ }

    // Request OS notification permission (best-effort, never mandatory).
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch { /* ignore */ }

    setArmed(true);
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* private mode */ }
  }, []);

  const pushNew = useCallback((orders: Order[]) => {
    if (orders.length === 0) return;
    setQueue((prev) => {
      // Deduplicate by order id so a Firestore retry doesn't double-alert.
      const existing = new Set(prev.map((o) => o.id));
      const fresh = orders.filter((o) => !existing.has(o.id));
      if (fresh.length === 0) return prev;

      // Fire one OS notification per new order if permission granted.
      for (const o of fresh) {
        try {
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const itemSummary = o.items.map((i) => `${i.name}×${i.qty}`).join(", ");
            new Notification(`🔔 New order — ${o.orderId}`, {
              body: `${o.customerName} · ${o.mealSlot} · ${itemSummary}`,
              tag: o.id, // dedupes if multiple tabs are open
            });
          }
        } catch { /* ignore */ }
      }

      return [...prev, ...fresh];
    });
  }, []);

  const acknowledge = useCallback(() => {
    setQueue([]);
    stopLoop();
    try {
      if (originalTitle.current) document.title = originalTitle.current;
    } catch { /* server */ }
  }, [stopLoop]);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return { armed, queue, muted, arm, pushNew, acknowledge, toggleMute };
}
