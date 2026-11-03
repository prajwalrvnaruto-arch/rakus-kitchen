import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description:
    "Cancellation and refund guidelines for food orders placed with Raku's Kitchen.",
};

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <div className="mb-10 text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-turmeric/40 bg-turmeric/10 px-3.5 py-1 text-xs font-bold text-turmericdark">
          🛡️ Consumer Protection & Refunds
        </span>
        <h1 className="section-title text-3xl sm:text-4xl">Refund & Cancellation Policy</h1>
        <p className="mt-3 text-sm text-soft">
          Effective Date: October 2026 · Governing Online Orders & Prepayments
        </p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-ink/90">
        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            1. Nature of Home-Cooked Food Orders
          </h2>
          <p>
            At <strong>{BUSINESS.name}</strong>, all meals are prepared fresh to order using premium,
            hygienically sourced perishable ingredients. Because we cook specifically for confirmed advance orders,
            cancellations and refunds are handled according to the structured schedule below.
          </p>
        </section>

        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            2. Cancellation Window
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Eligible for 100% Refund:</strong> Orders cancelled at least <strong>12 hours</strong> prior
              to the scheduled meal slot (before 12:30 AM for Lunch slots; before 7:30 AM for Dinner slots) are eligible
              for a full 100% refund.
            </li>
            <li>
              <strong>Non-Cancellable Window:</strong> Once the kitchen commences ingredient preparation and cooking
              (marked as &quot;Preparing&quot;), orders cannot be cancelled, modified, or refunded.
            </li>
            <li>
              <strong>Catering Orders:</strong> Large custom event orders or bulk biryani trays (&ge; 5 kg) require a minimum
              48-hour advance notice for cancellation to receive an 80% refund (20% retained for advance ingredient procurement).
            </li>
          </ul>
        </section>

        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            3. Kitchen-Initiated Cancellations
          </h2>
          <p>
            In the rare event that {BUSINESS.name} is unable to fulfill an order due to unforeseen ingredient shortage,
            kitchen emergency, extreme weather conditions, or delivery partner service disruptions:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>We will promptly notify you via phone call or WhatsApp message.</li>
            <li>A <strong>100% immediate full refund</strong> will be initiated automatically to your original payment method.</li>
          </ul>
        </section>

        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            4. Refund Processing Timelines
          </h2>
          <p>
            All approved refunds are credited back to the original source account (UPI, Credit/Debit Card, or Net Banking)
            processed securely through our authorized payment partner:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>UPI Payments:</strong> 24–48 banking hours.</li>
            <li><strong>Credit / Debit Cards & Net Banking:</strong> 5–7 business days (dependent on your issuing bank).</li>
          </ul>
        </section>

        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            5. Raising a Refund or Quality Concern
          </h2>
          <p>
            If there is any issue with packaging integrity or missing items upon delivery, please contact our support team
            within <strong>2 hours</strong> of receipt with a photo of the parcel:
          </p>
          <div className="rounded-xl border border-line bg-paper p-4 text-xs text-soft space-y-1">
            <p><strong>Kitchen Phone / WhatsApp:</strong> {BUSINESS.phoneDisplay}</p>
            <p><strong>Grievance Email:</strong> {BUSINESS.grievanceOfficer.email}</p>
            <p><strong>Kitchen Address:</strong> {BUSINESS.kitchenAddress}</p>
          </div>
          <p className="text-xs text-soft">
            For further details, please review our{" "}
            <Link href="/terms" className="text-chilidark underline font-semibold">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/delivery-policy" className="text-chilidark underline font-semibold">
              Shipping & Delivery Policy
            </Link>.
          </p>
        </section>
      </div>
    </div>
  );
}

