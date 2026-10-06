import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service governing food orders, delivery, payments, and Data Principal duties under the DPDP Act at Raku's Kitchen.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      {/* Header */}
      <div className="mb-10 text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-turmeric/40 bg-turmeric/10 px-3.5 py-1 text-xs font-bold text-turmericdark">
          📜 Commercial & Regulatory Terms
        </span>
        <h1 className="section-title text-3xl sm:text-4xl">Terms of Service</h1>
        <p className="mt-3 text-sm text-soft">
          Effective Date: October 4, 2026 · Last Updated: October 2026
        </p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-ink/90">
        {/* Section 1: Agreement */}
        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing the website, signing in via mobile phone OTP, placing an order, or utilizing any services provided
            by <strong>Raku&apos;s Kitchen</strong> (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you agree to be bound
            by these Terms of Service (&quot;Terms&quot;) and acknowledge our{" "}
            <Link href="/privacy" className="text-chilidark underline font-semibold">
              Privacy Policy & DPDP Statutory Notice
            </Link>.
          </p>
          <p>
            If you do not agree with any part of these Terms, you must discontinue your use of our platform and refrain
            from placing orders.
          </p>
        </section>

        {/* Section 2: Ordering & Payment */}
        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            2. Orders, Pricing & Payment
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-ink/90">
            <li>
              <strong>Advance Notice:</strong> Raku&apos;s Kitchen specializes in fresh, authentic home-cooked meals.
              Orders must be placed one day in advance for specified Lunch (ready 12:30 PM) or Dinner (ready 7:30 PM) slots.
            </li>
            <li>
              <strong>Pricing & Taxes:</strong> All menu item prices are quoted in Indian Rupees (₹ INR). Packaging and
              delivery charges are displayed transparently before payment checkout.
            </li>
            <li>
              <strong>Mandatory Online Payment:</strong> All orders are confirmed only upon successful payment authorization
              via our payment partner, <strong>Razorpay</strong>. We do not support Cash on Delivery (COD) for food orders.
            </li>
            <li>
              <strong>Order Confirmation:</strong> An order is deemed accepted only after successful payment verification
              and receipt of an order identifier (e.g. <code>RK-XXXXX</code>).
            </li>
          </ul>
        </section>

        {/* Section 3: Fulfillment & Delivery */}
        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            3. Fulfillment: Courier Delivery & Self-Pickup
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-paper p-4">
              <p className="font-bold text-ink">🛵 Courier Delivery</p>
              <p className="mt-1 text-xs text-soft">
                Delivery rides are dispatched via third-party logistics aggregators (Borzo, Porter, Shadowfax). Delivery
                times are estimates subject to Bangalore traffic and weather conditions. Customers must ensure an accurate
                drop location and be reachable at their registered mobile number.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-paper p-4">
              <p className="font-bold text-ink">🛍️ Self-Pickup</p>
              <p className="mt-1 text-xs text-soft">
                Customers selecting Self-Pickup may collect their freshly packed order directly from our kitchen in
                Jambusavari Dinne, JP Nagar 8th Phase, Bengaluru during designated slot windows (Lunch: 12:30 PM – 2:00 PM;
                Dinner: 7:30 PM – 9:30 PM).
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Cancellation & Refunds */}
        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            4. Cancellation & Refund Policy
          </h2>
          <p>
            Because our meals are cooked to order using fresh, perishable ingredients sourced early each morning:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-soft">
            <li>Orders can be cancelled with a full refund up to 12 hours prior to the scheduled meal slot.</li>
            <li>Once cooking has commenced (status set to &quot;Preparing&quot;), orders cannot be cancelled or refunded.</li>
            <li>In the rare event that the kitchen cannot fulfill an order due to ingredient availability or unforeseen emergency, a 100% refund is initiated automatically through Razorpay back to the original payment method within 5–7 business days.</li>
          </ul>
        </section>

        {/* Section 5: Duties of the Data Principal under DPDP Act */}
        <section className="card border-2 border-ok/30 bg-ok/5 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚖️</span>
            <h2 className="font-display text-xl font-bold text-ink">
              5. Statutory Duties of the Data Principal (Section 15 of DPDP Act, 2023)
            </h2>
          </div>
          <p>
            In accordance with Section 15 of the Digital Personal Data Protection Act, 2023, every customer (&quot;Data Principal&quot;)
            has the statutory obligation to comply with the following duties while using our services:
          </p>
          <ul className="list-decimal pl-5 space-y-2 text-xs text-ink/90">
            <li>
              <strong>Compliance with Laws:</strong> You shall comply with all applicable provisions of the DPDP Act and
              rules made thereunder while exercising your data protection rights.
            </li>
            <li>
              <strong>No Impersonation:</strong> You shall not impersonate another person or submit another individual&apos;s
              phone number, name, or address without lawful authorization.
            </li>
            <li>
              <strong>No Suppression of Material Facts:</strong> You shall not suppress any material information when providing
              your personal data for order fulfillment or when requesting identity verification.
            </li>
            <li>
              <strong>Authentic Information:</strong> You shall furnish only verifiably authentic and true information when
              exercising the right to correction or erasure under Section 12 of the Act.
            </li>
            <li>
              <strong>No Frivolous Grievances:</strong> You shall not register false, malicious, or frivolous complaints with
              our Grievance Officer or the Data Protection Board of India.
            </li>
          </ul>
        </section>

        {/* Section 6: Limitation of Liability */}
        <section className="card p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">
            6. Limitation of Liability & Governing Law
          </h2>
          <p className="text-xs text-soft">
            To the maximum extent permitted by law, Raku&apos;s Kitchen shall not be liable for indirect, incidental, or
            consequential damages arising from delivery delays caused by third-party logistics partners, traffic, or natural events.
            These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising hereunder
            shall be subject to the exclusive jurisdiction of the competent courts in Bengaluru, Karnataka.
          </p>
        </section>

        {/* Section 7: Grievance Redressal */}
        <section className="card p-6 sm:p-8 space-y-3">
          <h2 className="font-display text-base font-bold text-ink">
            7. Contact & Grievance Redressal
          </h2>
          <p className="text-xs text-soft">
            For operational support or privacy inquiries under the DPDP Act, contact our Grievance Officer:
          </p>
          <p className="font-mono text-xs text-ink">
            {BUSINESS.grievanceOfficer.name} ({BUSINESS.grievanceOfficer.designation})<br />
            Email: <a href={`mailto:${BUSINESS.grievanceOfficer.email}`} className="text-chilidark underline">{BUSINESS.grievanceOfficer.email}</a><br />
            Address: {BUSINESS.grievanceOfficer.address}
          </p>
        </section>
      </div>

      <div className="mt-10 text-center">
        <Link href="/" className="btn btn-chili px-6 py-2.5 text-xs font-bold shadow-md">
          ← Back to Raku&apos;s Kitchen Home
        </Link>
      </div>
    </div>
  );
}
