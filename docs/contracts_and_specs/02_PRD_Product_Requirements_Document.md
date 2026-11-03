# Product Requirements Document (PRD)

**Project:** Raku's Kitchen Ordering Engine & Kitchen Operations Dashboard  
**Client:** Raku's Kitchen (Bengaluru)  
**Technology Partner:** Nexus Development ([nexusdevelopment.in](https://nexusdevelopment.in))  
**Document Ref:** `NX-PRD-RK-2026-02`  
**Version:** 1.0 (Production Verified)  
**Date:** October 2026  

---

## 1. Executive Summary & Stack Architecture

The **Raku’s Kitchen platform** delivers a modern direct-to-consumer digital storefront for ordering authentic home-cooked Nati-style food, backed by an admin command center for kitchen operations, real-time dispatch, and courier automation.

### Certified Technology Stack:
- **Framework:** Next.js 14.2 (App Router, React 18, React Server Components)
- **Language:** TypeScript 5.6
- **Styling:** Tailwind CSS 3.4 + Lucide Icons
- **Authentication:** Firebase Auth (Phone OTP — zero-password onboarding)
- **Database:** Cloud Firestore (Real-time snapshot subscriptions)
- **Payment Gateway:** Razorpay SDK (Server-side order generation + HMAC-SHA256 webhook verification)
- **Maps API:** Ola Maps API (Autocomplete + reverse geocoding with lat/lng precision)
- **Courier Logistics:** Borzo 1-Click Business API + Porter deep-link launch helpers
- **Customer Communications:** WhatsApp `wa.me` contextual click-to-chat links

---

## 2. Core Functional Modules

### 2.1 Weight-Based Ordering & Biryani Picker Engine
- Dynamic weight selection: ½ kg, 1 kg, 2 kg, 3 kg with official pricing (Chicken Biryani: ₹400 / ₹799; Mutton Biryani: ₹799 / ₹1,599).
- Extra-meat add-on increments (250g) bound by parental biryani volume constraints.
- Cart auto-reconciliation prevents orphan add-on lines if base biryani line items are reduced or removed.
- Packaging fee rule: ₹20 per unit ordered, calculated by quantity count.

### 2.2 Order Slot Scheduling Engine
- Slots: **Lunch (12:30 PM Ready)** and **Dinner (7:30 PM Ready)**.
- Enforced weekly off-days: **Mondays and Thursdays** locked out.
- **Sunday Dinner locked out**.
- 1-Day advance booking cut-off enforced server-side.

### 2.3 Address & Geocoding Engine
- Ola Maps Autocomplete with Bangalore geofencing.
- Reverse geocoding validates exact customer doorstep coordinates (lat/lng) for courier route calculation.

### 2.4 Prepayment Engine (Razorpay)
- Zero trust on client prices: `recomputeOrderTotals` re-verifies all amounts before generating a Razorpay order ID.
- Webhook endpoint validates digital signature before saving status as `Confirmed`.

### 2.5 Real-Time Admin Command Dashboard (`/admin`)
- Subscribes via Firestore `onSnapshot` for zero-latency live order notifications.
- State machine: `Confirmed` &rarr; `Preparing` &rarr; `Out for Delivery` &rarr; `Delivered` (with `Cancelled` capability).
- **Borzo 1-Click Booking:** Computes delivery quote and assigns rider directly from admin UI.
- **Porter Helper:** Copies formatted address to clipboard and launches app.
- **WhatsApp Notification Buttons:** Auto-generates status updates for customer communication.

---

## 3. Data Schema & Firestore Structure

```json
{
  "orderId": "RK-2026-1004-9842",
  "customer": {
    "name": "Customer Name",
    "phone": "+919606888096",
    "uid": "firebase_auth_uid"
  },
  "slot": {
    "date": "2026-10-05",
    "meal": "lunch",
    "readyTime": "12:30 PM"
  },
  "items": [
    {
      "id": "chicken-biryani",
      "variant": "1kg",
      "quantity": 1,
      "unitPrice": 799,
      "extraMeat": 0,
      "extraMeatCost": 0
    }
  ],
  "financials": {
    "subtotal": 799,
    "packagingFee": 20,
    "deliveryFee": 0,
    "total": 819
  },
  "payment": {
    "provider": "razorpay",
    "orderId": "order_xyz123",
    "paymentId": "pay_abc456",
    "status": "PAID"
  },
  "delivery": {
    "address": "Jambusavari Dinne, JP Nagar 8th Phase, Bangalore",
    "lat": 12.8712,
    "lng": 77.5814,
    "provider": "borzo",
    "trackingId": "BORZO-99214"
  },
  "status": "Confirmed",
  "createdAt": "2026-10-04T12:00:00Z"
}
```

---

## 4. Security & Quality Attributes

1. **Firestore Security Rules:** Restricted customer access to self-owned UID documents; admin role restricted via `/admins/{uid}` collection verification.
2. **Resilience & Scalability:** Serverless architecture on Next.js handles sudden viral Instagram spikes without server provisioning overhead.
3. **Responsive UI:** Designed exclusively for high conversion on mobile smartphones (iOS & Android).
