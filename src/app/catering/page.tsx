"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { waMeLink } from "@/lib/whatsapp";
import { CATERING_MENU, formatINR } from "@/lib/menu";
import { WhatsAppIcon } from "@/components/icons";
import { BUSINESS } from "@/lib/config";
import { HOLIDAY_WEEKDAYS, NO_SUNDAY_DINNER } from "@/lib/order-dates";
import { AddressPicker } from "@/components/AddressPicker";
import type { AddressComponents, MealSlot } from "@/types";

const EVENT_TYPES = [
  "Wedding", "Birthday", "Engagement/Roce", "Housewarming", "Office event",
  "Festival / function", "Other",
];

const PERKS = [
  { emoji: "🍽️", title: "Any crowd size", text: "A small family lunch or a 300-guest function — we scale to you." },
  { emoji: "🥘", title: "Full Nati spread", text: "Biryani, chops, sambar, paya soup — the complete non-veg feast." },
  { emoji: "📍", title: "Across Bangalore", text: "We cook and deliver (or serve) wherever your event is." },
  { emoji: "📅", title: "Order ahead", text: "Tell us your date at least a day ahead so everything's weighed in advance." },
];

export default function CateringPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<MealSlot>("Lunch");
  const [guests, setGuests] = useState("");
  const [venueAddress, setVenueAddress] = useState<AddressComponents | null>(null);
  const [details, setDetails] = useState("");

  // Address search / "My location" proxy to billable Ola Maps calls that
  // require a signed-in user — same reason checkout requires sign-in.
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=%2Fcatering");
  }, [loading, user, router]);

  const handleAddressChange = useCallback((addr: AddressComponents | null) => {
    setVenueAddress(addr);
  }, []);

  // Minimum date is tomorrow (orders must be placed at least 1 day in advance)
  const minDateStr = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(
      tomorrow.getDate(),
    ).padStart(2, "0")}`;
  }, []);

  // Check schedule constraints matching regular orders (Mon/Thu closed, Sunday dinner not served).
  // These are hard blocks for catering too — the enquiry can't be sent until the
  // customer picks a valid date/slot, rather than just showing a soft warning.
  const scheduleWarning = useMemo(() => {
    if (!date) return null;
    const [y, m, d] = date.split("-").map(Number);
    const chosen = new Date(y, m - 1, d);
    const dow = chosen.getDay();

    if (HOLIDAY_WEEKDAYS.includes(dow)) {
      return "⚠️ Raku's Kitchen is closed on Mondays & Thursdays. Catering can't be scheduled on this day — please pick another date.";
    }
    if (slot === "Dinner" && NO_SUNDAY_DINNER && dow === 0) {
      return "⚠️ Sunday dinner is not served. Please choose Lunch for this date, or pick a different date for a Dinner event.";
    }
    return null;
  }, [date, slot]);

  // Hard block: a date has been chosen and it falls on a closed day (Mon/Thu),
  // or it's a Sunday with Dinner selected. Blocks sending the enquiry entirely,
  // not just a warning — matches the Mon/Thu/Sunday-dinner rule regular orders enforce.
  const scheduleBlocked = useMemo(() => {
    if (!date) return false;
    const [y, m, d] = date.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    if (HOLIDAY_WEEKDAYS.includes(dow)) return true;
    if (slot === "Dinner" && NO_SUNDAY_DINNER && dow === 0) return true;
    return false;
  }, [date, slot]);

  const addressValid = !!venueAddress;
  const canSend = !scheduleBlocked && addressValid;

  const formattedDate = useMemo(() => {
    if (!date) return "To be decided (looking for availability)";
    const [y, m, d] = date.split("-").map(Number);
    const chosen = new Date(y, m - 1, d);
    return chosen.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [date]);

  const readyTime = slot === "Lunch" ? BUSINESS.readyLunch : BUSINESS.readyDinner;

  const message = [
    "🎉 *Raku's Kitchen — Catering Enquiry*",
    "",
    `Event: ${eventType}`,
    `Date: ${formattedDate}`,
    `Meal Slot: ${slot} (Ready by ${readyTime})`,
    `Approx. guests: ${guests || "Not sure yet"}`,
    `Drop location: ${
      venueAddress
        ? `${venueAddress.displayAddress}${
            venueAddress.doorAndBuilding ? `, ${venueAddress.doorAndBuilding}` : ""
          }${venueAddress.landmark ? ` (near ${venueAddress.landmark})` : ""}`
        : "Not provided"
    }`,
    scheduleWarning ? `Note: ${scheduleWarning.replace(/^⚠️\s*/, "")}` : "",
    details ? `Details: ${details}` : "",
  ].filter(Boolean).join("\n");

  // Prop-based WhatsApp link (no auth needed for an enquiry).
  const href = waMeLink(message);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <div className="mb-10 text-center">
        <span className="chip mb-4 border-turmeric/40 bg-turmeric/10 text-turmerick">🎉 Custom catering</span>
        <h1 className="section-title">Catering for your event</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-soft">
          We cook authentic Nati-style food for weddings, birthdays and gatherings.
          Tell us about your event and we&apos;ll send you a quote on WhatsApp.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Enquiry form */}
        <div className="card p-6 sm:p-8">
          <h2 className="font-display text-lg font-semibold">Plan your feast</h2>
          <p className="mb-5 mt-1 text-xs text-soft">
            This opens WhatsApp with your enquiry drafted — just press send.
          </p>

          <label htmlFor="event" className="mb-1.5 block text-sm font-semibold">Type of event</label>
          <select
            id="event"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="field mb-4"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          {/* Meal Slot Picker (Lunch vs Dinner timeline) */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-semibold">Meal Slot</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSlot("Lunch")}
                className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${
                  slot === "Lunch"
                    ? "border-chili bg-chili/5 font-semibold text-chilidark shadow-sm"
                    : "border-line bg-paper text-ink hover:border-soft"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">☀️ Lunch</span>
                  {slot === "Lunch" && <span className="text-chili text-xs font-bold">✓ Selected</span>}
                </div>
                <span className="mt-1 block text-xs text-soft">Ready by {BUSINESS.readyLunch}</span>
              </button>

              <button
                type="button"
                onClick={() => setSlot("Dinner")}
                className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${
                  slot === "Dinner"
                    ? "border-chili bg-chili/5 font-semibold text-chilidark shadow-sm"
                    : "border-line bg-paper text-ink hover:border-soft"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">🌙 Dinner</span>
                  {slot === "Dinner" && <span className="text-chili text-xs font-bold">✓ Selected</span>}
                </div>
                <span className="mt-1 block text-xs text-soft">Ready by {BUSINESS.readyDinner}</span>
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-soft">
              Lunch ready {BUSINESS.readyLunch} · Dinner ready {BUSINESS.readyDinner} · Closed Mon &amp; Thu · Sunday dinner not served
            </p>
          </div>

          <label htmlFor="date" className="mb-1.5 block text-sm font-semibold">Event date</label>
          <input
            id="date"
            type="date"
            min={minDateStr}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="field mb-2"
          />
          <p className="mb-3 text-[11px] text-soft">
            Catering orders must be planned at least 1 day in advance.
          </p>

          {scheduleWarning && (
            <div className="mb-4 rounded-xl border border-turmeric/50 bg-turmeric/10 p-3 text-xs text-ink leading-relaxed animate-fade-in">
              {scheduleWarning}
            </div>
          )}

          <label htmlFor="guests" className="mb-1.5 block text-sm font-semibold">Approximate guests</label>
          <input
            id="guests"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="e.g. 50"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            className="field mb-4"
          />

          <label className="mb-1.5 block text-sm font-semibold">
            Event / drop location{" "}
            <span className="text-chili" aria-hidden>*</span>
          </label>
          <div className="mb-4">
            <AddressPicker value={venueAddress} onChange={handleAddressChange} />
          </div>
          <p className="-mt-3 mb-4 text-[11px] text-soft">
            So we can quote delivery and plan logistics for your event.
          </p>

          <label htmlFor="details" className="mb-1.5 block text-sm font-semibold">Anything else?</label>
          <textarea
            id="details"
            rows={3}
            placeholder="Veg/no-eggs, live counter, delivery vs on-site serving…"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="field mb-5 resize-none"
          />

          {scheduleBlocked ? (
            <button
              type="button"
              disabled
              className="btn btn-chili w-full cursor-not-allowed opacity-50"
              title="Pick a date Raku's Kitchen is open for"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Choose a different date to send enquiry
            </button>
          ) : (
            <a
              href={canSend ? href : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!canSend}
              onClick={(e) => {
                if (!canSend) e.preventDefault();
              }}
              className={`btn btn-chili w-full ${!canSend ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <WhatsAppIcon className="h-5 w-5" />
              Send catering enquiry ({slot} · Ready {readyTime})
            </a>
          )}
          {!addressValid && !scheduleBlocked && (
            <p className="mt-2 text-[11px] text-soft">
              Add the event / drop location above to send your enquiry.
            </p>
          )}
        </div>

        {/* Perks */}
        <div className="grid content-start gap-4 sm:grid-cols-2">
          {PERKS.map((perk) => (
            <div key={perk.title} className="card p-5">
              <span className="text-3xl" aria-hidden>{perk.emoji}</span>
              <h3 className="mt-2 font-display font-semibold">{perk.title}</h3>
              <p className="mt-1 text-sm text-soft">{perk.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Display-only catering price list (not cart-addable) */}
      <section className="mt-12">
        <div className="mb-4 text-center">
          <h2 className="font-display text-xl font-semibold">Menu on request</h2>
          <p className="mx-auto mt-1 max-w-2xl text-sm text-soft">
            These dishes aren&apos;t on the daily menu — they&apos;re cooked to order for
            catering and bulk orders. Mention them in your enquiry and we&apos;ll confirm
            pricing and quantities.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-soft">
                <th className="py-2 pr-4 font-semibold">Dish</th>
                <th className="py-2 pr-4 font-semibold">Price</th>
                <th className="py-2 font-semibold">Unit</th>
              </tr>
            </thead>
            <tbody>
              {CATERING_MENU.map((item) => (
                <tr key={item.id} className="border-b border-ink/5">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2.5">
                      {item.photo ? (
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg ring-1 ring-ink/10">
                          <Image src={item.photo} alt={item.name} fill sizes="44px" className="object-cover" />
                        </div>
                      ) : (
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-ink/5 text-xl" aria-hidden>
                          {item.emoji}
                        </span>
                      )}
                      <span className="font-medium">{item.name}</span>
                      {item.veg && <span className="chip" title="Vegetarian">🟢</span>}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 font-semibold">{formatINR(item.price ?? 0)}</td>
                  <td className="py-2.5 text-soft">{item.unit ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}