# Business Requirements Document (BRD)

**Project:** Direct-to-Consumer Cloud Kitchen & Catering Digital Platform  
**Client Entity:** Raku's Kitchen (JP Nagar 8th Phase, Bengaluru)  
**Technology Partner:** Nexus Development ([nexusdevelopment.in](https://nexusdevelopment.in))  
**Document Ref:** `NX-BRD-RK-2026-01`  
**Version:** 1.0 (Delivered Production Baseline)  
**Date:** October 2026  

---

## 1. Executive Summary & Problem Statement

**Raku’s Kitchen** is a high-demand home kitchen and catering establishment specializing in authentic Karnataka Nati-style food (Chicken Biryani, Mutton Biryani, Nati Koli Saru, Chops, and Kebabs). Prior to engagement with Nexus Development, customer acquisition and order intake took place exclusively via Instagram (`@rakus.kitchen`) and direct WhatsApp / Phone conversations (`9606888096`).

### Critical Bottlenecks of Legacy Operations:
1. **Order Leakage & Miscommunication:** Weight specifications (½ kg, 1 kg, multi-kg) and ingredient ratios were manually clarified across lengthy chat threads, leading to occasional customer dissatisfaction regarding portion expectations.
2. **Logistics Chaos:** Delivery addresses had to be copied by hand into courier apps (Borzo/Porter), resulting in dispatch typos and lost delivery partners.
3. **Kitchen Capacity Overselling:** With strict batch readiness timings (12:30 PM for Lunch, 7:30 PM for Dinner, closed Mon/Thu, no Sun dinner), manual logging made real-time capacity management impossible.

---

## 2. Strategic Objectives & ROI

| Objective | Legacy Baseline | Delivered Platform | Measurable Business ROI |
| :--- | :--- | :--- | :--- |
| **Pre-Paid Order Capture** | Manual UPI transfers & COD | 100% mandatory prepayment via Razorpay PG | Eliminated unpaid food preparation waste and cancellations. |
| **Order Placement Velocity** | 8–12 minutes per customer on WhatsApp | < 90 seconds self-serve checkout | Kitchen handles 10x peak festival volume with zero staff overhead. |
| **Logistics Automation** | Manual address re-typing | Ola Maps validated coordinates + Borzo 1-Click API | Zero address typos; instant courier matching. |
| **Inventory Integrity** | Ad-hoc meat portioning | Strict weight tiers with auto-clamping add-ons | Zero meat ratio disputes. |

---

## 3. Business Process Transformation (AS-IS vs. TO-BE)

### AS-IS Process (Manual):
`Instagram Reel / Story` &rarr; `Customer DMs or WhatsApps 9606888096` &rarr; `Manual Menu Text Exchange` &rarr; `Manual Price + Packaging Calculation` &rarr; `Kitchen shares UPI QR` &rarr; `Customer uploads screenshot` &rarr; `Kitchen checks bank balance` &rarr; `Kitchen re-types address into Porter/Borzo` &rarr; `High error rate & stress`.

### TO-BE Process (Automated via Nexus Platform):
`Instagram Bio Link` &rarr; `Interactive Next.js Web App` &rarr; `Slot Selector (Lunch/Dinner with advance notice validation)` &rarr; `Weight-Based Biryani & Dishes Picker` &rarr; `Cart with Server-Enforced Packaging Fee (₹20/unit)` &rarr; `Ola Maps Geocoded Address` &rarr; `Razorpay Secure Payment` &rarr; `Real-Time Firestore Sync & Customer WhatsApp Message` &rarr; `1-Click Borzo Dispatch from Admin Console` &rarr; `Order Live Tracking`.

---

## 4. Business Rules & Operational Constraints

1. **Kitchen Operating Schedule:**
   - **Lunch:** Ready for dispatch at **12:30 PM**.
   - **Dinner:** Ready for dispatch at **7:30 PM**.
   - **Weekly Holidays:** **Mondays and Thursdays** (ordering disabled).
   - **Sunday Exception:** **No Sunday dinner** service.
   - **Advance Ordering:** Orders must be placed at least one day in advance.
2. **Portion & Weight Ratios:**
   - Biryani sold strictly by weight: ½ kg (250g meat), 1 kg (500g meat), 2 kg (1000g meat), 3 kg (1500g meat).
   - Extra meat add-ons (250g increments) capped strictly per base biryani weight tier.
3. **Cart Constraints:**
   - Extra meat add-ons cannot exist orphaned in cart without parent dish.
4. **Packaging Fee:**
   - ₹20 per item unit across all containers.
5. **Doorstep Delivery Fee:**
   - Direct-to-courier model: Customer pays delivery fee to Borzo / Porter partner at the door; not collected upfront.

---

## 5. Stakeholder Matrix & Governance

- **Client Primary (Raku's Kitchen):** Owner / Operator responsible for day-to-day order preparation, status updates, and customer relationship.
- **Technology Partner (Nexus Development):** Senior Business Analyst and Project Delivery Lead overseeing cloud infrastructure setup, full-stack development, continuous system maintenance, and free menu/price updates under the ₹55,000 contract (including 1-Year maintenance warranty coverage).
