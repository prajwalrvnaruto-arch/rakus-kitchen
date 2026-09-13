"use client";

import { useState } from "react";
import { waMeLink } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/icons";

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
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("");
  const [details, setDetails] = useState("");

  const message = [
    "🎉 *Raku's Kitchen — Catering Enquiry*",
    "",
    `Event: ${eventType}`,
    `Date: ${date || "To be decided (looking for availability)"}`,
    `Approx. guests: ${guests || "Not sure yet"}`,
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

          <label htmlFor="date" className="mb-1.5 block text-sm font-semibold">Event date</label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="field mb-4"
          />

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

          <label htmlFor="details" className="mb-1.5 block text-sm font-semibold">Anything else?</label>
          <textarea
            id="details"
            rows={3}
            placeholder="Veg/no-eggs, live counter, delivery vs on-site serving…"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="field mb-5 resize-none"
          />

          <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-chili w-full">
            <WhatsAppIcon className="h-5 w-5" />
            Send catering enquiry
          </a>
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
    </div>
  );
}