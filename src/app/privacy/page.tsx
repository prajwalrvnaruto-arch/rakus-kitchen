"use client";

import { useState } from "react";
import Link from "next/link";
import { BUSINESS } from "@/lib/config";

export default function PrivacyPage() {
  const [lang, setLang] = useState<"en" | "kn">("en");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      {/* Header */}
      <div className="mb-8 text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-ok/30 bg-ok/10 px-3.5 py-1 text-xs font-bold text-ok">
          🛡️ DPDP Act, 2023 & DPDP Rules, 2025 Compliant
        </span>
        <h1 className="section-title text-3xl sm:text-4xl">
          {lang === "en" ? "Privacy Policy & Statutory Notice" : "ಗೌಪ್ಯತಾ ನೀತಿ ಮತ್ತು ಶಾಸನಬದ್ಧ ಸೂಚನೆ"}
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-soft">
          {lang === "en"
            ? "Published under Section 5 of the Digital Personal Data Protection Act, 2023 · Effective October 2026"
            : "ಡಿಜಿಟಲ್ ವೈಯಕ್ತಿಕ ಡೇಟಾ ಸಂರಕ್ಷಣಾ ಕಾಯ್ದೆ ೨೦೨೩ರ ಸೆಕ್ಷನ್ ೫ರ ಅನ್ವಯ ಪ್ರಕಟಿಸಲಾಗಿದೆ · ಜಾರಿಯ ದಿನಾಂಕ: ಅಕ್ಟೋಬರ್ ೨೦೨೬"}
        </p>

        {/* Section 5(3) Multilingual Selector */}
        <div className="mt-5 inline-flex items-center rounded-2xl border border-line bg-paper p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`rounded-xl px-4 py-1.5 text-xs font-bold transition ${
              lang === "en"
                ? "bg-chili text-white shadow-sm"
                : "text-soft hover:text-ink"
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang("kn")}
            className={`rounded-xl px-4 py-1.5 text-xs font-bold transition ${
              lang === "kn"
                ? "bg-chili text-white shadow-sm"
                : "text-soft hover:text-ink"
            }`}
          >
            ಕನ್ನಡ (Kannada - 8th Schedule)
          </button>
        </div>
      </div>

      {lang === "en" ? (
        /* ── ENGLISH STATUTORY NOTICE ── */
        <div className="space-y-8 text-sm leading-relaxed text-ink/90">
          {/* Section 1: Introduction */}
          <section className="card p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold text-ink">
              1. Introduction & Scope
            </h2>
            <p>
              Welcome to <strong>Raku&apos;s Kitchen</strong> (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;).
              This Privacy Policy and Statutory Notice is published in accordance with the provisions of{" "}
              <strong>The Digital Personal Data Protection Act, 2023 (&quot;DPDP Act&quot;)</strong> and the{" "}
              <strong>Digital Personal Data Protection Rules, 2025 (&quot;DPDP Rules&quot;)</strong> of India.
            </p>
            <p>
              Raku&apos;s Kitchen acts as a <strong>Data Fiduciary</strong> in respect of the digital personal data
              collected from our customers (&quot;<strong>Data Principals</strong>&quot;) when you visit our website,
              sign in, order food, or interact with our customer support.
            </p>
          </section>

          {/* Section 2: Personal Data Collected */}
          <section className="card p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold text-ink">
              2. Itemized Notice of Personal Data Collected (Section 5)
            </h2>
            <p>
              In compliance with Section 5 of the DPDP Act, we provide itemized notice of the specific personal data
              we collect:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-ink/90">
              <li>
                <strong>Identity & Contact Details:</strong> Your name and 10-digit mobile number, verified via secure
                One-Time Password (OTP).
              </li>
              <li>
                <strong>Delivery Location & Spatial Data:</strong> Delivery address, apartment/door number, landmark,
                pincode, and geographic coordinates (latitude and longitude) obtained via Ola Maps to route food delivery riders.
              </li>
              <li>
                <strong>Transaction & Order Details:</strong> Meal slots (Lunch/Dinner), meal dates, items ordered,
                special cooking notes, billing amounts, packaging fees, and fulfillment type (courier delivery or self-pickup).
              </li>
              <li>
                <strong>Payment Metadata:</strong> Transaction reference IDs, Razorpay Order IDs, and payment status.
                <span className="block mt-1 text-xs text-soft italic">
                  * Note: We do NOT store or process your credit/debit card numbers, CVVs, net-banking credentials, or UPI PINs.
                  All monetary transactions are processed securely through RBI-authorized payment aggregator Razorpay.
                </span>
              </li>
              <li>
                <strong>Technical Logs:</strong> Order creation timestamps and temporary rate-limiting hashes utilized
                strictly for abuse prevention and fraud defense.
              </li>
            </ul>
          </section>

          {/* Section 3: Specified Purposes of Processing */}
          <section className="card p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold text-ink">
              3. Specified Purposes for Processing (Section 4 & 6)
            </h2>
            <p>We process your personal data strictly for specified, lawful purposes:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">🍲 Order Preparation</p>
                <p className="mt-1 text-xs text-soft">
                  To prepare your selected authentic Nati-style dishes for the requested meal slot.
                </p>
              </div>
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">🛵 Delivery & Logistics</p>
                <p className="mt-1 text-xs text-soft">
                  To route third-party delivery riders (Borzo, Porter, Shadowfax) or prepare your bag for self-pickup.
                </p>
              </div>
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">🔔 Status Notifications</p>
                <p className="mt-1 text-xs text-soft">
                  To send live order confirmations, preparation alerts, and tracking links via WhatsApp or SMS.
                </p>
              </div>
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">📑 Legal & Accounting</p>
                <p className="mt-1 text-xs text-soft">
                  To generate GST-compliant invoices and preserve audit records mandated under Indian fiscal regulations.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Data Processors */}
          <section className="card p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold text-ink">
              4. Third-Party Data Processors (Section 8(2))
            </h2>
            <p>
              To deliver our services, we engage reputable third-party service providers (&quot;Data Processors&quot;)
              under strict confidentiality and security requirements:
            </p>
            <div className="divide-y divide-line/60 rounded-xl border border-line bg-paper overflow-hidden text-xs">
              <div className="p-3">
                <p className="font-bold text-ink">Razorpay Software Private Limited</p>
                <p className="text-soft">Payment processing, transaction settlements, and refund management (RBI Regulated).</p>
              </div>
              <div className="p-3">
                <p className="font-bold text-ink">Google Cloud & Firebase</p>
                <p className="text-soft">Cloud hosting, encrypted Firestore database, and Phone OTP authentication.</p>
              </div>
              <div className="p-3">
                <p className="font-bold text-ink">Ola Maps (ANI Technologies)</p>
                <p className="text-soft">Address autocomplete, places lookup, and delivery coordinate geocoding.</p>
              </div>
              <div className="p-3">
                <p className="font-bold text-ink">Logistics Carriers (Borzo, Porter, Shadowfax)</p>
                <p className="text-soft">Courier dispatch, driver assignment, and live delivery transit.</p>
              </div>
              <div className="p-3">
                <p className="font-bold text-ink">WhatsApp (Meta Platforms)</p>
                <p className="text-soft">Customer order status updates initiated through direct conversational links.</p>
              </div>
            </div>
          </section>

          {/* Section 5: Rights of Data Principals */}
          <section className="card p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold text-ink">
              5. Your Rights as a Data Principal (Sections 11–14)
            </h2>
            <p>Under Chapter III of the DPDP Act, 2023, you have the following enforceable statutory rights:</p>
            <div className="space-y-3">
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">1. Right to Access Information (Section 11)</p>
                <p className="text-xs text-soft mt-1">
                  You have the right to request a summary of the personal data we hold about you and the identities of
                  all Data Processors with whom it has been shared. You can view your complete order history at any time on the{" "}
                  <Link href="/orders" className="text-chilidark underline font-semibold">Track Orders</Link> page.
                </p>
              </div>
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">2. Right to Correction and Erasure (Section 12)</p>
                <p className="text-xs text-soft mt-1">
                  You have the right to request correction of inaccurate or misleading data, and erasure of personal data
                  that is no longer necessary for the specified purpose, unless retention is legally mandatory under Indian tax or commercial laws.
                </p>
              </div>
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">3. Right of Grievance Redressal (Section 13)</p>
                <p className="text-xs text-soft mt-1">
                  You have the right to have your data protection grievances addressed expeditiously by our designated
                  Grievance Officer within statutory timelines (15 days).
                </p>
              </div>
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">4. Right to Nominate (Section 14)</p>
                <p className="text-xs text-soft mt-1">
                  You have the right to nominate another individual who shall exercise your privacy rights in the event
                  of death or incapacity.
                </p>
              </div>
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">5. Right to Withdraw Consent (Section 6(4))</p>
                <p className="text-xs text-soft mt-1">
                  Where processing is based on consent, you may withdraw it at any time. Withdrawal will not affect the
                  lawfulness of processing completed prior to withdrawal.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6: Children's Data */}
          <section className="card p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold text-ink">
              6. Processing of Children&apos;s Data (Section 9)
            </h2>
            <p>
              Raku&apos;s Kitchen does not target or knowingly collect personal data from individuals under 18 years of age.
              Our food ordering platform is intended exclusively for adults. If you are under 18, you may use our platform
              only under the supervision and with the verifiable consent of a parent or legal guardian. We do not engage
              in behavioral monitoring, tracking, or targeted advertising directed at children.
            </p>
          </section>

          {/* Section 7: Security & Storage Limitation */}
          <section className="card p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold text-ink">
              7. Reasonable Security Safeguards & Data Retention (Section 8(5) & 8(7))
            </h2>
            <p>
              We implement comprehensive organizational and technical security measures to protect your digital personal data:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-soft">
              <li><strong>Zero Client Writes:</strong> All order materialization is performed exclusively server-side after cryptographic payment signature verification.</li>
              <li><strong>Encrypted in Transit & Rest:</strong> Industry-standard TLS 1.3 encryption across all network transfers.</li>
              <li><strong>Automated Log Expiration:</strong> Platform audit and operational logs automatically expire and are purged after 30 days via Firestore TTL policies.</li>
              <li><strong>Statutory Retention:</strong> Financial transaction and invoice records are preserved for the statutory period required by the Goods and Services Tax (GST) Act and Income Tax regulations, after which they are permanently deleted or anonymized.</li>
            </ul>
          </section>

          {/* Section 8: Grievance Redressal & Board Complaint */}
          <section className="card border-2 border-turmeric bg-turmeric/5 p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚖️</span>
              <h2 className="font-display text-xl font-bold text-ink">
                8. Grievance Officer & Statutory Complaint Mechanism
              </h2>
            </div>
            <p>
              If you have any questions, wish to exercise your rights under Sections 11–14 of the DPDP Act, or have a
              grievance concerning how your personal data is handled, please contact our designated Grievance Officer:
            </p>

            <div className="rounded-xl border border-line bg-paper p-4 text-xs space-y-1.5 font-mono">
              <p className="font-sans font-bold text-sm text-ink">{BUSINESS.grievanceOfficer.name}</p>
              <p className="text-soft font-sans">{BUSINESS.grievanceOfficer.designation} · Raku&apos;s Kitchen</p>
              <p><strong>Email:</strong> <a href={`mailto:${BUSINESS.grievanceOfficer.email}`} className="text-chilidark underline">{BUSINESS.grievanceOfficer.email}</a> (cc: {BUSINESS.grievanceOfficer.backupEmail})</p>
              <p><strong>Phone:</strong> {BUSINESS.grievanceOfficer.phone}</p>
              <p><strong>Address:</strong> {BUSINESS.grievanceOfficer.address}</p>
              <p><strong>Response SLA:</strong> Within {BUSINESS.grievanceOfficer.slaDays} business days</p>
            </div>

            <div className="rounded-xl border border-line/60 bg-paper/60 p-3.5 text-xs text-soft space-y-1">
              <p className="font-bold text-ink">Escalation to the Data Protection Board of India (DPBI):</p>
              <p>
                In accordance with Section 13(3) of the DPDP Act, 2023, if your grievance is not resolved to your satisfaction
                by our Grievance Officer within the statutory period, you have the statutory right to file a complaint directly
                with the <strong>Data Protection Board of India (DPBI)</strong>.
              </p>
            </div>
          </section>
        </div>
      ) : (
        /* ── KANNADA STATUTORY NOTICE (Section 5(3)) ── */
        <div className="space-y-8 text-sm leading-relaxed text-ink/90">
          <section className="card p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold text-ink">
              ೧. ಪರಿಚಯ ಮತ್ತು ವ್ಯಾಪ್ತಿ (Introduction & Scope)
            </h2>
            <p>
              <strong>ರಾಕುಸ್ ಕಿಚನ್‌ಗೆ (Raku&apos;s Kitchen)</strong> ಸುಸ್ವಾಗತ. ಭಾರತದ <strong>ಡಿಜಿಟಲ್ ವೈಯಕ್ತಿಕ ಡೇಟಾ ಸಂರಕ್ಷಣಾ ಕಾಯ್ದೆ, ೨೦೨೩ (DPDP Act)</strong> ಮತ್ತು{" "}
              <strong>DPDP ನಿಯಮಗಳು, ೨೦೨೫ರ</strong> ಸೆಕ್ಷನ್ ೫ರ ಅನ್ವಯ ಈ ಶಾಸನಬದ್ಧ ಗೌಪ್ಯತಾ ಸೂಚನೆಯನ್ನು ಕನ್ನಡದಲ್ಲಿ ಒದಗಿಸಲಾಗಿದೆ.
            </p>
            <p>
              ನೀವು ನಮ್ಮ ಜಾಲತಾಣವನ್ನು ಬಳಸುವಾಗ, ಸೈನ್ ಇನ್ ಮಾಡುವಾಗ ಅಥವಾ ಊಟವನ್ನು ಆರ್ಡರ್ ಮಾಡುವಾಗ ಸಂಗ್ರಹಿಸಲಾಗುವ ನಿಮ್ಮ ಡಿಜಿಟಲ್ ವೈಯಕ್ತಿಕ ಮಾಹಿತಿಗೆ ಸಂಬಂಧಿಸಿದಂತೆ ರಾಕುಸ್ ಕಿಚನ್{" "}
              <strong>ಡೇಟಾ ಫಿಡೂಷಿಯರಿಯಾಗಿ (Data Fiduciary)</strong> ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ.
            </p>
          </section>

          <section className="card p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold text-ink">
              ೨. ಸಂಗ್ರಹಿಸಲಾಗುವ ವೈಯಕ್ತಿಕ ವಿವರಗಳು (Personal Data Collected)
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>ಗುರುತು ಮತ್ತು ಸಂಪರ್ಕ:</strong> ನಿಮ್ಮ ಹೆಸರು ಮತ್ತು ಒಟಿಪಿ (OTP) ಮೂಲಕ ಪರಿಶೀಲಿಸಲಾದ ೧೦-ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ.</li>
              <li><strong>ವಿತರಣಾ ವಿಳಾಸ ಮತ್ತು ಸ್ಥಳ:</strong> ನಿಮ್ಮ ವಿಳಾಸ, ಮನೆ/ಫ್ಲಾಟ್ ಸಂಖ್ಯೆ, ಹೆಗ್ಗುರುತು, ಪಿನ್‌ಕೋಡ್ ಮತ್ತು ಓಲಾ ಮ್ಯಾಪ್ಸ್ (Ola Maps) ಮೂಲಕ ಪಡೆದ ಜಿಪಿಎಸ್ ಅಕ್ಷಾಂಶ-ರೇಖಾಂಶಗಳು (ಡೆಲಿವರಿ ರೈಡರ್‌ಗಳು ಊಟವನ್ನು ತಲುಪಿಸಲು ಮಾತ್ರ).</li>
              <li><strong>ಆರ್ಡರ್ ವಿವರಗಳು:</strong> ಊಟದ ಸಮಯ (ಮಧ್ಯಾಹ್ನ/ರಾತ್ರಿ), ದಿನಾಂಕ, ಆರ್ಡರ್ ಮಾಡಿದ ಅಡುಗೆಗಳು ಮತ್ತು ವಿಶೇಷ ಸೂಚನೆಗಳು.</li>
              <li><strong>ಪಾವತಿ ವಿವರಗಳು:</strong> ರೇಜರ್‌ಪೇ (Razorpay) ವಹಿವಾಟು ಐಡಿ. ನಾವು ನಿಮ್ಮ ಕ್ರೆಡಿಟ್/ಡೆಬಿಟ್ ಕಾರ್ಡ್ ಸಂಖ್ಯೆ ಅಥವಾ ಯುಪಿಐ ಪಿನ್ (UPI PIN) ಅನ್ನು ಎಂದಿಗೂ ಸಂಗ್ರಹಿಸುವುದಿಲ್ಲ.</li>
            </ul>
          </section>

          <section className="card p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold text-ink">
              ೩. ಮಾಹಿತಿ ಬಳಕೆಯ ನಿರ್ದಿಷ್ಟ ಉದ್ದೇಶಗಳು (Specified Purposes)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">🍲 ಊಟ ತಯಾರಿಕೆ</p>
                <p className="mt-1 text-xs text-soft">ನಿಮ್ಮ ಇಷ್ಟದ ನಾಟಿ ಶೈಲಿಯ ತಾಜಾ ಊಟವನ್ನು ನಿಗದಿತ ಸಮಯಕ್ಕೆ ಸಿದ್ಧಪಡಿಸಲು.</p>
              </div>
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">🛵 ಮನೆ ಬಾಗಿಲಿಗೆ ವಿತರಣೆ</p>
                <p className="mt-1 text-xs text-soft">ಬೋರ್ಜೊ, ಪೋರ್ಟರ್, ಅಥವಾ ಶ್ಯಾಡೋಫ್ಯಾಕ್ಸ್ ರೈಡರ್ ಮೂಲಕ ನಿಮ್ಮ ವಿಳಾಸಕ್ಕೆ ತಲುಪಿಸಲು.</p>
              </div>
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">🔔 ವಾಟ್ಸಾಪ್ ಮಾಹಿತಿ</p>
                <p className="mt-1 text-xs text-soft">ಆರ್ಡರ್ ಸ್ವೀಕಾರ, ತಯಾರಿಕೆ ಮತ್ತು ಡೆಲಿವರಿ ಮಾಹಿತಿಯನ್ನು ನೇರವಾಗಿ ವಾಟ್ಸಾಪ್ ಮೂಲಕ ಕಳುಹಿಸಲು.</p>
              </div>
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">📑 ಕಾನೂನುಬದ್ಧ ಲೆಕ್ಕಪತ್ರ</p>
                <p className="mt-1 text-xs text-soft">ಜಿಎಸ್‌ಟಿ (GST) ಮತ್ತು ಭಾರತೀಯ ತೆರಿಗೆ ನಿಯಮಗಳ ಅನ್ವಯ ಬಿಲ್ ರಶೀದಿ ನಿರ್ವಹಿಸಲು.</p>
              </div>
            </div>
          </section>

          <section className="card p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold text-ink">
              ೪. ಗ್ರಾಹಕರ ಶಾಸನಬದ್ಧ ಹಕ್ಕುಗಳು (Data Principal Rights)
            </h2>
            <div className="space-y-3">
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">೧. ಮಾಹಿತಿ ಪಡೆಯುವ ಹಕ್ಕು (Right to Access - Section 11)</p>
                <p className="text-xs text-soft mt-1">ನಿಮ್ಮ ಆರ್ಡರ್ ಇತಿಹಾಸ ಮತ್ತು ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸುವ ಹಕ್ಕು.</p>
              </div>
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">೨. ತಿದ್ದುಪಡಿ ಮತ್ತು ಅಳಿಸುವ ಹಕ್ಕು (Right to Correction & Erasure - Section 12)</p>
                <p className="text-xs text-soft mt-1">ತಪ್ಪಾದ ಮಾಹಿತಿಯನ್ನು ಸರಿಪಡಿಸಲು ಅಥವಾ ಅಗತ್ಯವಿಲ್ಲದ ವೈಯಕ್ತಿಕ ವಿವರಗಳನ್ನು ಅಳಿಸಲು ವಿನಂತಿಸುವ ಹಕ್ಕು.</p>
              </div>
              <div className="rounded-xl border border-line bg-paper p-3.5">
                <p className="font-bold text-ink">೩. ದೂರು ನಿವಾರಣೆ ಮತ್ತು ನಾಮನಿರ್ದೇಶನ ಹಕ್ಕು (Sections 13 & 14)</p>
                <p className="text-xs text-soft mt-1">ಗೌಪ್ಯತಾ ದೂರುಗಳನ್ನು ನಮ್ಮ ದೂರು ಅಧಿಕಾರಿಯ ಬಳಿ ಸಲ್ಲಿಸುವ ಮತ್ತು ನಾಮನಿರ್ದೇಶನ ಮಾಡುವ ಹಕ್ಕು.</p>
              </div>
            </div>
          </section>

          <section className="card border-2 border-turmeric bg-turmeric/5 p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚖️</span>
              <h2 className="font-display text-xl font-bold text-ink">
                ೫. ದೂರು ನಿವಾರಣಾ ಅಧಿಕಾರಿ ಮತ್ತು ಮಂಡಳಿಗೆ ದೂರು (Grievance Redressal)
              </h2>
            </div>
            <p>ಯಾವುದೇ ಗೌಪ್ಯತಾ ವಿಚಾರಣೆ ಅಥವಾ ಹಕ್ಕುಗಳನ್ನು ಚಲಾಯಿಸಲು ನಮ್ಮ ದೂರು ಅಧಿಕಾರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ:</p>
            <div className="rounded-xl border border-line bg-paper p-4 text-xs font-mono space-y-1.5">
              <p className="font-sans font-bold text-sm text-ink">{BUSINESS.grievanceOfficer.name}</p>
              <p className="text-soft font-sans">{BUSINESS.grievanceOfficer.designation} · ರಾಕುಸ್ ಕಿಚನ್</p>
              <p><strong>ಇಮೇಲ್:</strong> <a href={`mailto:${BUSINESS.grievanceOfficer.email}`} className="text-chilidark underline">{BUSINESS.grievanceOfficer.email}</a></p>
              <p><strong>ದೂರವಾಣಿ:</strong> {BUSINESS.grievanceOfficer.phone}</p>
              <p><strong>ವಿಳಾಸ:</strong> {BUSINESS.grievanceOfficer.address}</p>
              <p><strong>ಪರಿಹಾರ ಅವಧಿ:</strong> ೧೫ ದಿನಗಳ ಒಳಗೆ</p>
            </div>
            <p className="text-xs text-soft">
              ನಮ್ಮ ದೂರು ಅಧಿಕಾರಿಯಿಂದ ನಿಮ್ಮ ಸಮಸ್ಯೆಗೆ ತೃಪ್ತಿದಾಯಕ ಪರಿಹಾರ ದೊರೆಯದಿದ್ದಲ್ಲಿ, ಸೆಕ್ಷನ್ ೧೩(೩)ರ ಅನ್ವಯ{" "}
              <strong>ಭಾರತೀಯ ಡೇಟಾ ಸಂರಕ್ಷಣಾ ಮಂಡಳಿಗೆ (Data Protection Board of India - DPBI)</strong> ನೇರವಾಗಿ ದೂರು ಸಲ್ಲಿಸುವ ಹಕ್ಕನ್ನು ನೀವು ಹೊಂದಿರುತ್ತೀರಿ.
            </p>
          </section>
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href="/" className="btn btn-chili px-6 py-2.5 text-xs font-bold shadow-md">
          {lang === "en" ? "← Back to Raku's Kitchen Home" : "← ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ"}
        </Link>
      </div>
    </div>
  );
}
