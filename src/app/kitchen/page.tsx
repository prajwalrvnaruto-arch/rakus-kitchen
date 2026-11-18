"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { KitchenPrepSlot } from "@/components/KitchenPrepSlot";
import { beginKitchenSignOut } from "@/components/kitchenSignOut";
import type { SlotPrepSummary } from "@/lib/kitchenPrep";

// How often to re-pull the prep sheet while the page is open. Orders trickle
// in over a day, so a ~20s poll keeps the kitchen current without a client-side
// Firestore read (which would expose customer PII). A refetch on tab-focus
// covers the gap when staff come back to a sheet left open.
const POLL_MS = 20000;

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const formatDateLabel = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("en-IN", { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-IN", { month: "short" });
  const year = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
};

const shortDateLabel = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${String(date.getDate()).padStart(2, "0")} ${date.toLocaleDateString("en-IN", { month: "short" })}`;
};

const addDays = (dateStr: string, delta: number) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return dateKey(date);
};

interface PrepPayload {
  lunch: SlotPrepSummary;
  dinner: SlotPrepSummary;
}

export default function KitchenPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(() => dateKey(new Date()));
  const todayKey = useMemo(() => dateKey(new Date()), []);
  const [prep, setPrep] = useState<PrepPayload | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // The date currently being shown, held in a ref so the poll callback always
  // fetches the latest selection without re-arming the interval on every change.
  const dateRef = useRef(selectedDate);
  dateRef.current = selectedDate;

  // Fetch the aggregated prep sheet from the server (PII never reaches the
  // client). `background` keeps the current sheet on screen during a poll/focus
  // refetch; only a date change clears to the loading skeleton.
  const loadPrep = useCallback(async (background: boolean) => {
    if (!background) setPrep(null);
    const date = dateRef.current;
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) return; // not signed in yet — the gate handles this
      const res = await fetch(`/api/kitchen/prep?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`prep request failed (${res.status})`);
      const data: PrepPayload = await res.json();
      if (dateRef.current !== date) return; // a newer date was selected mid-flight
      setOrderError(null);
      setPrep(data);
    } catch (err) {
      setOrderError((err as Error).message);
    }
  }, []);

  // Reload whenever the date changes (clears to skeleton), then poll in the
  // background and refetch when the tab regains focus.
  useEffect(() => {
    loadPrep(false);
    const interval = setInterval(() => loadPrep(true), POLL_MS);
    const onFocus = () => loadPrep(true);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [selectedDate, loadPrep]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">🍳 Kitchen Prep Sheet</h1>
          <p className="text-sm text-soft">Combined cooking quantities per meal slot — read-only.</p>
        </div>
        <button
          onClick={() => {
            // Raise the flag so KitchenGate won't redirect to /login when auth
            // goes null, then navigate home and sign out. The user lands on "/".
            beginKitchenSignOut();
            router.push("/");
            signOut(auth!);
          }}
          className="btn btn-ghost px-4 py-2 text-xs"
        >
          Sign out
        </button>
      </header>

      {/* Date navigation */}
      <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
        <button
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
          className="btn btn-ghost px-3 py-1.5 text-sm"
          aria-label="Previous day"
        >
          ← {shortDateLabel(addDays(selectedDate, -1))}
        </button>
        <div className="text-center">
          <p className="font-display text-base font-bold text-ink">
            {formatDateLabel(selectedDate)}
          </p>
          {selectedDate === todayKey && (
            <span className="text-xs font-semibold text-ok">Today</span>
          )}
        </div>
        <button
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
          className="btn btn-ghost px-3 py-1.5 text-sm"
          aria-label="Next day"
        >
          {shortDateLabel(addDays(selectedDate, 1))} →
        </button>
      </div>

      {selectedDate !== todayKey && (
        <div className="mb-4 flex justify-center">
          <button
            onClick={() => setSelectedDate(todayKey)}
            className="btn btn-ghost px-4 py-1.5 text-xs"
          >
            Jump to today
          </button>
        </div>
      )}

      {orderError && (
        <div className="mb-4 rounded-xl border border-chili/30 bg-chili/5 px-4 py-3 text-sm text-chili">
          Orders hit a snag loading — retrying automatically.
        </div>
      )}

      {prep === null ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="card h-48 animate-pulse bg-cream/60 p-5" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <KitchenPrepSlot summary={prep.lunch} />
          <KitchenPrepSlot summary={prep.dinner} />
        </div>
      )}
    </div>
  );
}
