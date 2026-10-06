# Client Welcome Kit & Onboarding Guide

**Prepared For:** Raku's Kitchen (Bengaluru, Karnataka)  
**Prepared By:** Nexus Development ([https://nexusdevelopment.in](https://nexusdevelopment.in))  
**Document Ref:** `NX-CWK-RK-2026-00`  
**Effective Date:** October 2026  
**Engagement Type:** Custom Food Ordering Platform & Kitchen Dispatch Engine  
**Contract Value:** ₹1,50,000 INR (Freelancer Supply / Exempt from GST)  

---

## 1. Executive Welcome & Partnership Vision

**Dear Team Raku's Kitchen,**

Welcome to your new digital home. On behalf of the engineering and delivery team at **Nexus Development**, we are proud to formally hand over your custom-engineered Direct-to-Consumer Food Ordering Platform and Kitchen Dispatch Engine.

Over the past two months of close collaboration, our goal was clear: **to liberate Raku's Kitchen from high 25%–30% food aggregator commissions** and establish your independent brand identity with an elite, lightning-fast digital storefront. 

With this platform:
- **100% of customer order revenue flows directly into your bank account** via Razorpay.
- You own your customer database, phone numbers, and repeat ordering relationships.
- Kitchen dispatch is automated through integrated courier APIs (Borzo 1-Click Dispatch & Porter deep-links).
- Customers receive instant WhatsApp notifications at every step of cooking and transit.

We consider ourselves your long-term technology partners. This welcome document provides everything you need to operate, administer, and scale your cloud kitchen with complete confidence.

---

## 2. What Has Been Built & Delivered

Your platform is built on modern, scalable, enterprise-grade cloud architecture:

| System Layer | Technology | Business Function |
| :--- | :--- | :--- |
| **Customer Storefront** | Next.js 14 (App Router) + React + Tailwind CSS | Sub-second mobile ordering experience, Biryani weight selectors (½ kg, 1 kg, multi-kg), lunch/dinner advance booking slots. |
| **Authentication** | Firebase Phone OTP (Passwordless) | Frictionless customer sign-in with verified mobile numbers; zero lost passwords. |
| **Database & Real-Time Sync** | Google Cloud Firestore | Live real-time order synchronization between customer orders and your kitchen screen. |
| **Address & Geocoding** | Ola Maps API | Bangalore hyper-local address autocomplete, pin-drop precision, and doorstep delivery accuracy. |
| **Payment Gateway** | Razorpay PG with Server-Side HMAC-SHA256 | Instant UPI, Credit/Debit card, and Net Banking payments with 100% automated prepayment validation. |
| **Logistics Engine** | Borzo 1-Click Business API + Porter Deep-Links | Instant rider dispatch with pre-filled pickup/drop addresses, customer phone sync, and live tracking. |
| **Admin Command Center** | `/admin` Portal | Live order queue, stage advancement (Confirmed &rarr; Preparing &rarr; Out for Delivery &rarr; Delivered), and delivery assignment. |
| **Messaging Engine** | WhatsApp Business Click-to-Chat | Context-aware WhatsApp updates sent directly to customers with tracking links and rider phone numbers. |
| **Compliance & Privacy** | DPDP Act (2023) Architecture | Verified data isolation, customer privacy notice, explicit OTP consent, and automated audit logging. |

---

## 3. Master Access & Systems Directory

All accounts are **100% client-owned** by Raku's Kitchen. Nexus Development does not hold intermediary custody over your customer data or payment balances.

| Resource | URL / Access Point | Role & Operational Use |
| :--- | :--- | :--- |
| **Live Customer Storefront** | `[Production Domain]` | Customer-facing menu, weight selection, slot picker, and checkout. |
| **Admin Command Dashboard** | `[Production Domain]/admin` | Real-time order monitoring, status updates, Borzo rider booking, and WhatsApp triggers. |
| **Google Cloud / Firebase Console** | `console.firebase.google.com` | Cloud hosting, Firestore database records, authentication logs, and security rules. |
| **Razorpay Merchant Dashboard** | `dashboard.razorpay.com` | Daily payment settlements, bank payout reports, transaction refund handling. |
| **Ola Maps Developer Console** | `maps.olacabs.com` | API quota monitoring and Bangalore geocoding metrics. |
| **Borzo Delivery Dashboard** | `borzodelivery.com/in` | Courier recharge wallet balance, active rider tracking, and delivery history. |
| **Documentation Portal** | `[Docs Hub]/index.html` | Complete suite of legal SOW, SLA, BRD, PRD, and Milestone Invoices. |

---

## 4. Daily Kitchen Operations Playbook (The 5-Step Routine)

To ensure seamless daily order fulfillment during your lunch (12:30 PM) and dinner (7:30 PM) operating windows, follow this battle-tested routine:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  STEP 1: 10:00AM │ ──> │  STEP 2: 11:30AM │ ──> │  STEP 3: 12:15PM │ ──> │  STEP 4: 12:30PM │ ──> │  STEP 5: CLOSE   │
│  Open /admin     │     │  Batch Orders &  │     │  Trigger Borzo   │     │  Rider Handover  │     │  Archive Orders  │
│  Verify Menu     │     │  Start Cooking   │     │  1-Click Booking │     │  WhatsApp Alert  │     │  Review Payouts  │
└──────────────────┘     └──────────────────┘     └──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Step 1: Morning Check & Menu Verification (10:00 AM)
1. Open `/admin` on your kitchen tablet, laptop, or mobile browser.
2. Verify that todays specialties and Biryani varieties are in stock.
3. If an item is sold out, inform Nexus Development for instant menu modification.

### Step 2: Batching & Preparation (11:30 AM for Lunch / 6:00 PM for Dinner)
1. Filter orders by **Lunch Slot** (12:30 PM delivery) or **Dinner Slot** (7:30 PM delivery).
2. Tally total cooked weight requirements (e.g., 5 kg Chicken Biryani, 5 kg Mutton Biryani).
3. Click **"Mark as Preparing"** on incoming orders to let customers know cooking is underway.

### Step 3: Courier Dispatch Booking (15 Minutes Before Delivery Slot)
1. In the `/admin` order card, review the verified Ola Maps drop address.
2. Click **"Book Borzo Rider"**:
   - The system automatically sends pickup (Jambusavari Dinne) and drop coordinates to Borzo.
   - The rider is assigned, and their phone number/tracking link populates automatically.
   - *Fallback:* If Borzo is busy, click **"Open in Porter"** for pre-filled manual dispatch.

### Step 4: Rider Handover & WhatsApp Customer Alert
1. Hand the packaged Biryani box (labeled with customer name & order ID) to the rider.
2. Click **"Send WhatsApp Update"**:
   - Opens a pre-composed WhatsApp message: *"Your Raku's Kitchen order is out for delivery! Rider: [Name], Live Tracking: [Link]"*.
3. Mark status as **"Out for Delivery"**.

### Step 5: Order Completion & Settlement Review
1. Once the customer receives the delivery, mark status as **"Delivered"**.
2. Check your **Razorpay Merchant Dashboard** to verify that prepayments are routed to your bank account on standard T+1 settlement.

---

## 5. Ongoing Support & Maintenance (SLA Summary)

Your **₹1,50,000 contract value** includes full, ongoing Annual Maintenance Contract (AMC) coverage provided by Nexus Development:

### What Is Covered at ZERO Additional Cost:
- **100% Bug Remediation:** Any issue related to Next.js, Firebase Auth, Firestore, Razorpay checkout, Ola Maps, Borzo API, or the Admin panel is fixed immediately.
- **Menu Additions & Removals:** Adding new seasonal curries, starters, or Biryani cuts.
- **Price Tweaks & Portion Adjustments:** Changing per-kg prices, portion weights, or descriptions.
- **Operational Settings:** Toggling festival holidays, modifying packaging charges (₹20/unit), or updating delivery slot timings.

### What Is Billed Separately (New Features):
- Any brand-new software modules beyond the delivered scope (e.g., multi-outlet kitchen management, native iOS/Android App Store builds, custom loyalty points) are quoted in advance and billed at **₹600/hour** (Time & Materials).

### Support Channels & Escalation:
- **Critical / Emergency Incidents (P1/P2 - Checkout down or admin locked):**  
  Direct WhatsApp priority hotline to Nexus Project Lead (`< 1 hour response`).
- **Routine Maintenance & Menu Changes (P3/P4):**  
  Email to `contactus@nexusdevelopment.in` with subject `[RK-SUPPORT]` (`< 6 hours response`).
- **Support Coverage Hours:** 10:00 AM – 9:00 PM IST (Tuesday through Sunday).

---

## 6. Four High-Impact Growth Recommendations for Raku's Kitchen

To maximize your return on this digital investment and capture the full ₹5.5L–₹11L monthly kitchen potential, we recommend these immediate operational steps:

1. **Place the Direct Order Link in Your Instagram Bio:**
   - Add your platform link directly to your profile bio with a clear call-to-action: *"Order fresh hand-crafted Dum Biryani directly — Lunch (12:30 PM) & Dinner (7:30 PM)"*.
2. **Include QR Code Inserts in Packaging Bags:**
   - Print a small thank-you card or bag sticker with a QR code pointing directly to your ordering platform.
   - Offer direct customers a guaranteed free sweet, extra gravy, or priority dispatch compared to third-party apps.
3. **Run 24-Hour Advance Weekend Broadcasts:**
   - Every Friday morning, send a WhatsApp broadcast to your repeat customer list announcing weekend Biryani slot bookings.
   - Because biryani is prepared in batches, advance slot bookings eliminate kitchen food waste.
4. **Leverage Zero Aggregator Commission:**
   - Since you save 25%–30% on every order through your own platform, you can maintain generous portion sizes and premium meat quality without inflating customer prices.

---

## 7. Master Documentation Suite Navigation

Your full legal, technical, and commercial agreement suite is available in the documentation portal:

| Document | Description | Format Links |
| :--- | :--- | :--- |
| **01. BRD** | Business Requirements Document (Workflows, KPIs, ROI) | [HTML](file:///Volumes/Segate%20SSD/Desktop/For_Instagram_influencers/rakus-kitchen/docs/contracts_and_specs/01_BRD_Business_Requirements_Document.html) \| [Markdown](file:///Volumes/Segate%20SSD/Desktop/For_Instagram_influencers/rakus-kitchen/docs/contracts_and_specs/01_BRD_Business_Requirements_Document.md) |
| **02. PRD** | Product Requirements Document (Architecture & Specs) | [HTML](file:///Volumes/Segate%20SSD/Desktop/For_Instagram_influencers/rakus-kitchen/docs/contracts_and_specs/02_PRD_Product_Requirements_Document.html) \| [Markdown](file:///Volumes/Segate%20SSD/Desktop/For_Instagram_influencers/rakus-kitchen/docs/contracts_and_specs/02_PRD_Product_Requirements_Document.md) |
| **03. SOW** | Statement of Work (₹1,50,000 Scope & Milestone Terms) | [HTML](file:///Volumes/Segate%20SSD/Desktop/For_Instagram_influencers/rakus-kitchen/docs/contracts_and_specs/03_SOW_Statement_of_Work.html) \| [Markdown](file:///Volumes/Segate%20SSD/Desktop/For_Instagram_influencers/rakus-kitchen/docs/contracts_and_specs/03_SOW_Statement_of_Work.md) |
| **04. SLA** | Service Level Agreement (Response MTTR & Warranty) | [HTML](file:///Volumes/Segate%20SSD/Desktop/For_Instagram_influencers/rakus-kitchen/docs/contracts_and_specs/04_SLA_Service_Level_Agreement.html) \| [Markdown](file:///Volumes/Segate%20SSD/Desktop/For_Instagram_influencers/rakus-kitchen/docs/contracts_and_specs/04_SLA_Service_Level_Agreement.md) |
| **05. Invoices** | Milestone Tax Invoices & Master Statement of Account | [HTML](file:///Volumes/Segate%20SSD/Desktop/For_Instagram_influencers/rakus-kitchen/docs/contracts_and_specs/05_Milestone_Invoices.html) \| [Markdown](file:///Volumes/Segate%20SSD/Desktop/For_Instagram_influencers/rakus-kitchen/docs/contracts_and_specs/05_Milestone_Invoices.md) |

---

## 8. Welcome Sign-off & Partnership Commitment

We are honored to have engineered this platform for Raku's Kitchen and look forward to seeing your kitchen expand across Bengaluru.

**For Nexus Development:**  
*Solutions Architecture & Project Delivery Leadership*  
Website: [https://nexusdevelopment.in](https://nexusdevelopment.in)  
Email: `contactus@nexusdevelopment.in`  
Bengaluru, Karnataka  

**Accepted with Thanks:**  
*Raku's Kitchen (Management & Operations)*  
Jambusavari Dinne, JP Nagar 8th Phase, Bengaluru, Karnataka – 560083  
Phone: +91 9606888096  
