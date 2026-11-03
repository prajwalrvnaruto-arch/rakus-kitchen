import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy",
  description:
    "Fulfillment, pickup guidelines, and courier delivery policies for Raku's Kitchen Bangalore.",
};

export default function DeliveryPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <div className="mb-10 text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-turmeric/40 bg-turmeric/10 px-3.5 py-1 text-xs font-bold text-turmericdark">
          🛵 Order Fulfillment & Dispatch
        </span>
        <h1 className="section-title text-3xl sm:text-4xl">Shipping & Delivery Policy</h1>
        <p className="mt-3 text-sm text-soft">
          Effective Date: October 2026 · Bengaluru Fulfillment Network
        </p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-ink/90">
        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            1. Kitchen Operations & Slot Schedule
          </h2>
          <p>
            {BUSINESS.name} prepares traditional Nati-style dishes in dedicated fresh-batch cooking slots.
            Orders must be placed one day in advance for the following windows:
          </p>
          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-line bg-paper p-4 space-y-1">
              <p className="font-bold text-ink text-sm">☀️ Lunch Slot</p>
              <p className="text-soft">Dispatched: 12:30 PM onwards</p>
              <p className="text-soft">Self-Pickup Window: 12:30 PM – 2:00 PM</p>
              <p className="text-turmericdark font-semibold">Advance cutoff: Previous evening 10:00 PM</p>
            </div>
            <div className="rounded-xl border border-line bg-paper p-4 space-y-1">
              <p className="font-bold text-ink text-sm">🌙 Dinner Slot</p>
              <p className="text-soft">Dispatched: 7:30 PM onwards</p>
              <p className="text-soft">Self-Pickup Window: 7:30 PM – 9:30 PM</p>
              <p className="text-turmericdark font-semibold">Advance cutoff: Same day 1:00 PM</p>
            </div>
          </div>
          <p className="text-xs text-soft">
            * <em>Note: Our kitchen remains closed on Mondays and Thursdays for deep sanitation and fresh sourcing.</em>
          </p>
        </section>

        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            2. Delivery Radius & Logistics Aggregators
          </h2>
          <p>
            We fulfill courier delivery orders across Bengaluru through integrated on-demand logistics partners
            (<strong>Borzo</strong> and <strong>Porter</strong>).
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Primary Delivery Zone:</strong> JP Nagar, Jayanagar, Bannerghatta Road, BTM Layout,
              Arekere, Hulimavu, and surrounding South Bengaluru areas (estimated transit: 25–45 minutes).
            </li>
            <li>
              <strong>Extended City Zone:</strong> Delivery throughout Greater Bengaluru is available subject to partner
              courier availability and surge pricing.
            </li>
            <li>
              <strong>Live Tracking:</strong> Once dispatched, a live tracking link with the assigned delivery partner&apos;s
              details and rider contact is shared via SMS / WhatsApp.
            </li>
          </ul>
        </section>

        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            3. Delivery Charges & Packaging
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Delivery Fee:</strong> Delivery charges are computed based on actual distance, vehicle type, and third-party
              courier fare rates. Any applicable delivery fee is shown transparently at checkout before payment.
            </li>
            <li>
              <strong>Packaging Standard:</strong> All food is sealed in food-grade, leak-proof, microwave-safe, tamper-evident
              containers (₹20 per item packaging fee) to preserve temperature and aroma during transit.
            </li>
          </ul>
        </section>

        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            4. Self-Pickup Option
          </h2>
          <p>
            Customers who prefer to collect their food in person pay zero delivery fee. Simply select <strong>Self-Pickup</strong> at checkout.
          </p>
          <div className="rounded-xl border border-line bg-paper p-4 text-xs text-soft space-y-1">
            <p className="font-semibold text-ink text-sm">📍 Kitchen Pickup Address:</p>
            <p>{BUSINESS.kitchenAddress}</p>
            <p><strong>Contact:</strong> {BUSINESS.phoneDisplay}</p>
          </div>
        </section>

        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            5. Customer Responsibility & Delivery Delays
          </h2>
          <p>
            To ensure timely delivery:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-soft">
            <li>Please ensure your delivery address, flat/unit number, landmark, and reachable phone number are accurate at checkout.</li>
            <li>If the delivery partner is unable to contact you upon arrival at the gate/drop address after 10 minutes of waiting, the order may be marked undelivered without refund eligibility due to the perishable nature of hot food.</li>
            <li>Delivery times may occasionally vary due to Bengaluru traffic or monsoon weather. Our team works proactively with riders to minimize delays.</li>
          </ul>
          <p className="text-xs text-soft">
            Questions regarding an in-transit order? Reach our dispatch desk via{" "}
            <Link href="/contact" className="text-chilidark underline font-semibold">
              Contact Us
            </Link>{" "}
            or WhatsApp at {BUSINESS.phoneDisplay}.
          </p>
        </section>
      </div>
    </div>
  );
}

