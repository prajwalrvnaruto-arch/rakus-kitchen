# Product Requirements Document: Raku's Kitchen

## Overview

Raku's Kitchen is a production food-ordering web application for a home-run kitchen business in Bangalore, India. Customers browse a daily menu, build a cart, pay online via Razorpay, and receive order confirmations and status updates through WhatsApp. An admin dashboard manages orders, triggers third-party delivery (Borzo API / Porter app), and sends per-status WhatsApp notifications to customers.

The application is live at production scale, serving real customers and processing real payments.

## Business Context

- **Business type:** Home kitchen / cloud kitchen (non-veg Nati-style food)
- **Location:** Jambusavari Dinne, JP Nagar 8th Phase, Bangalore
- **Operating hours:** Lunch (ready 12:30 PM), Dinner (ready 7:30 PM); closed Mondays & Thursdays; **no Sunday dinner**
- **Ordering model:** Orders placed one day in advance via the web app or WhatsApp
- **Delivery:** Third-party partners (Borzo 1-Click API, Porter app deep-link); delivery charges paid by customer to partner at the door
- **Payment:** Mandatory prepay via Razorpay (test + live modes supported)

## Target Users

- **Customers:** Bangalore residents ordering home-cooked Nati-style food for delivery
- **Admin (kitchen owner):** Manages orders, updates statuses, books delivery rides, sends WhatsApp messages to customers
- **Delivery partners:** Borzo (automated API booking) and Porter (manual app-based booking with clipboard helpers)

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, React 18) |
| Language | TypeScript 5.6 |
| Styling | Tailwind CSS 3.4 |
| Authentication | Firebase Auth (Phone OTP — `PhoneOtpForm.tsx`) |
| Database | Cloud Firestore (orders collection, admin allowlist) |
| Payments | Razorpay (server-side order creation + webhook verification) |
| Maps/Geocoding | Ola Maps API (autocomplete + reverse geocoding) |
| Delivery — automated | Borzo Business API (1-click ride booking from admin) |
| Delivery — manual | Porter app (deep-link launch + clipboard copy helper) |
| Messaging | WhatsApp via `wa.me` click-to-open links (no API — browser-based) |
| Hosting | (Not specified — standard Next.js deployment) |
| Package manager | npm, `package-lock.json` |

### Key Dependencies

```json
{
  "firebase": "^11.0.2",
  "firebase-admin": "^12.7.0",
  "next": "^14.2.15",
  "razorpay": "^2.9.4",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "server-only": "^0.0.1"
}
```

## Functional Requirements

### Customer-Facing Features

#### Menu & Cart
- Daily menu with categories: Biryani, Chicken Specialities, Mutton Specialities, Other Items
- Biryani picker with weight selection (½/1/2/3 kg), meat choice (chicken/mutton), and extra-meat add-ons (250g increments with per-weight-tier caps)
- Variant-based pricing (e.g. ½ kg / 1 kg options) for non-biryani dishes
- Cart stored in localStorage with `(menuId, variant)` composite key per line
- Cart reconciliation: extra-meat add-on lines are auto-clamped/dropped when their parent biryani line is removed or reduced
- Packaging fee: ₹20 per unit (quantity-based, not line-based)
- Cart drawer (slide-over panel) with quantity steppers and remove buttons

#### Authentication
- Phone number OTP login via Firebase Auth
- No email/password — phone-only auth
- Admin role gating via Firestore `/admins/{uid}` document check

#### Checkout & Payment
- Meal slot picker (Lunch / Dinner) with date selection
- Structured address input via Ola Maps autocomplete + reverse geocoding
- Address components: displayAddress, doorAndBuilding, landmark, city, pincode, lat/lng
- Server-side price recomputation (`recomputeOrderTotals` in `menu.ts`) — client prices are never trusted
- Razorpay payment flow: server creates order → client opens Razorpay checkout → server verifies payment via webhook
- Order saved to Firestore with status `Confirmed`, full payment metadata, and status history

#### Order Tracking (Customer)
- `/orders` page: real-time order list via Firestore `onSnapshot`
- `OrderStatusSteps` component shows visual status progress
- "Send to kitchen" WhatsApp button (only for `Confirmed` orders — gated by status)
- "Reorder" button repopulates cart from a past order

#### WhatsApp Messaging (Customer-Facing)
- Post-checkout: "Send order on WhatsApp" button sends NEW ORDER template to kitchen number
- Generic "WhatsApp us" / "Ask about a dish" links on home, menu, contact, footer pages
- Catering enquiry form generates a pre-filled WhatsApp message
- All links use `waMeLink()` helper sourced from `BUSINESS.phoneIntl` in config (no hardcoded numbers)

### Admin Features

#### Order Dashboard (`/admin`)
- Real-time order list via Firestore `subscribeAllOrders`
- Orders sorted by action priority: Confirmed → Preparing → Out for Delivery
- Archived section for Delivered/Cancelled orders
- Per-order detail card: customer info, address (with Google Maps link), items, totals, notes
- Forward-only status dropdown (Confirmed → Preparing → Out for Delivery → Delivered; Cancelled available at each step)
- Admin access verification tool (checks UID doc, token, collection read, update probe)

#### Delivery Dispatch
- **Borzo (automated):** 1-click API booking via `/api/delivery/borzo` route; updates order with `deliveryMeta` (carrierId, carrierOrderId, fareEstimate, trackingUrl)
- **Porter (manual):** Deep-link to Porter app + clipboard copy of drop address; Porter Copy Helper with individual copy buttons for drop address, building details, receiver name, phone (10-digit normalized)
- Delivery booking available when status is `Confirmed` or `Preparing` and no carrier is already booked

#### WhatsApp Messaging (Admin-Facing)
- Per-status "Message customer on WhatsApp" button for every status (including Preparing)
- Status-specific message templates: Confirmed, Preparing, Out for Delivery, Delivered, Cancelled
- Messages addressed to the customer's phone number via `waLinkToCustomer(order, status)`

### Catering
- Display-only price list for catering-exclusive dishes (not cart-addable)
- Catering enquiry form → WhatsApp message with event type, date, guest count, details

## Non-Functional Requirements

### Security
- Firebase Auth for authentication (phone OTP)
- Firestore security rules with UID-keyed admin allowlist
- Server-side price verification — client-submitted prices are never trusted
- Razorpay webhook signature verification for payment confirmation
- Firebase Admin SDK used server-side only (`server-only` package enforces this)
- Environment variables for all API keys (Razorpay, Borzo, Ola Maps, Firebase)
- **Firestore data sanitization** (`src/lib/sanitize.ts` strips `undefined` values before writes)
- No hardcoded secrets in client-side code

### Performance
- Static generation for public pages (menu, biryani, catering, contact, about)
- Dynamic server-rendering for API routes only
- Image optimization via Next.js `<Image>` component with WebP format
- Client-side cart stored in localStorage (no server round-trips for cart ops)

### Data Integrity
- Server-side order total recomputation prevents price tampering
- Extra-meat add-on budget enforcement both client-side (cart reconciliation) and server-side (`recomputeOrderTotals`)
- Firestore rules enforce that only admins can update order status
- Payment metadata (Razorpay order ID, payment ID, status) attached to every order

### Accessibility
- Semantic HTML with proper `aria-label` attributes on interactive elements
- Keyboard navigation (Escape to close cart drawer)
- Veg/non-veg badges on menu items

## Project Structure

```
src/
├── app/
│   ├── admin/page.tsx          # Admin order dashboard
│   ├── api/
│   │   ├── delivery/borzo/     # Borzo delivery API route
│   │   ├── maps/               # Ola Maps proxy routes (autocomplete, reverse-geocode)
│   │   └── payments/           # Razorpay routes (create-order, verify, webhook)
│   ├── biryani/                # Biryani weight picker page
│   ├── catering/               # Catering enquiry page
│   ├── checkout/page.tsx       # Checkout + payment flow
│   ├── contact/                # Contact page
│   ├── login/page.tsx          # Phone OTP login
│   ├── menu/page.tsx           # Full menu with category navigation
│   ├── orders/page.tsx         # Customer order tracking
│   └── layout.tsx              # Root layout with CartProvider, AuthProvider
├── components/
│   ├── AddressPicker.tsx       # Ola Maps address input
│   ├── BiryaniPicker.tsx       # Biryani weight/meat/extra-meat selector
│   ├── CartDrawer.tsx          # Slide-over cart panel
│   ├── DishCard.tsx            # Menu item card with variant picker
│   ├── OrderStatusSteps.tsx    # Visual order status progress
│   ├── PhoneOtpForm.tsx        # Firebase phone auth form
│   └── QtyStepper.tsx          # Quantity +/- stepper
├── lib/
│   ├── auth-context.tsx        # Firebase auth context + admin role check
│   ├── borzo.ts                # Borzo API client
│   ├── cart-context.tsx        # Cart state (localStorage + reconciliation)
│   ├── config.ts               # Business constants (name, phone, address, coords)
│   ├── db.ts                   # Firestore operations (orders, admin)
│   ├── firebase.ts             # Firebase client init
│   ├── menu.ts                 # Menu data, pricing, server-side price recomputation
│   ├── olaMaps.ts              # Ola Maps API helpers
│   ├── order-dates.ts          # Meal slot + date logic
│   ├── placesClient.ts         # Places autocomplete client
│   ├── porterDeepLink.ts       # Porter deep-link + clipboard helpers
│   ├── sanitize.ts             # Input sanitization
│   ├── whatsapp.ts             # WhatsApp message builders + wa.me link helpers
│   └── server/
│       ├── firebaseAdmin.ts    # Firebase Admin SDK init (server-only)
│       ├── paymentIntents.ts   # Razorpay order creation
│       └── razorpay.ts         # Razorpay client init
└── types.ts                    # Shared TypeScript types
```

## Environment Variables

| Variable | Purpose | Side |
|----------|---------|------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web app config | Client |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | Client |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firestore project | Client |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage | Client |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging | Client |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | Client |
| `NEXT_PUBLIC_EMULATOR` | Use local Firebase emulators | Client |
| `OLA_MAPS_API_KEY` | Ola Maps geocoding/autocomplete | Server |
| `BORZO_API_KEY` | Borzo delivery API | Server |
| `BORZO_API_BASE` | Borzo API base URL (test/prod) | Server |
| `RAZORPAY_KEY_ID` | Razorpay public key | Server |
| `RAZORPAY_KEY_SECRET` | Razorpay secret key | Server |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signature secret | Server |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay public key (client fallback) | Client |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Admin SDK project ID | Server |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Admin SDK client email | Server |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Admin SDK private key | Server |

## Firestore Data Model

### Collections

- **`orders`** — One document per placed order
  - Fields: `orderId`, `customerId`, `customerName`, `phone`, `deliveryAddress`, `addressComponents`, `mealSlot`, `mealDate`, `items[]` (OrderLineItem), `itemTotal`, `packagingFee`, `grandTotal`, `status`, `statusHistory[]`, `payment` (PaymentMeta), `deliveryMeta`, `notes`, `createdAt`, `updatedAt`
- **`admins`** — UID-keyed documents for admin allowlist
  - Existence of `/admins/{uid}` grants admin access
- **`paymentIntents`** — Server-only: holds draft orders between Razorpay creation and payment verification
- **`webhookEvents`** — Server-only: deduplication log for Razorpay webhook deliveries
- **`meta/counters`** — Counter for auto-incrementing `RK-xxxxx` order IDs

### Security Rules
- Customers can read their own orders (`customerId == request.auth.uid`)
- Admins (with doc in `/admins/{uid}`) can read all orders and update order status
- Orders are created by authenticated users only
- Admin doc creation restricted to existing admins

---

## SDLC Execution Instructions

### Scope: Testing & Security ONLY

This PRD is intended for use with [autonomous-sdlc](https://github.com/bitbitcodes/autonomous-sdlc). The orchestrator should execute **only Phase 7 (Testing) and Phase 8 (Security)**. All other phases (Problem Discovery, Product, Story-Tasks, Architecture, Design, Development, Review, DevOps, Observability, Retirement) must be **disabled/skipped**.

### Phase Configuration

After running `sdlc init .`, configure phases to execute only testing and security:

```bash
# Disable all phases except Testing and Security
sdlc phases --disable problem-discovery
sdlc phases --disable product
sdlc phases --disable story-tasks
sdlc phases --disable architecture
sdlc phases --disable design
sdlc phases --disable development
sdlc phases --disable review
sdlc phases --disable devops
sdlc phases --disable observability
sdlc phases --disable retirement
```

Or configure `.sdlc/phase-config.json`:

```json
{
  "phases": {
    "problem-discovery": { "enabled": false },
    "product": { "enabled": false },
    "story-tasks": { "enabled": false },
    "architecture": { "enabled": false },
    "design": { "enabled": false },
    "development": { "enabled": false },
    "testing": { "enabled": true },
    "security": { "enabled": true },
    "review": { "enabled": false },
    "devops": { "enabled": false },
    "observability": { "enabled": false },
    "retirement": { "enabled": false }
  }
}
```

### Phase 7: Testing — What to Execute

The Testing stage agent (`stage-testing`) should dispatch all 4 subagents:

| Subagent | Focus Area for Raku's Kitchen |
|----------|-------------------------------|
| **Test Data Generator** | Generate realistic order fixtures (biryani + extra-meat combos, variant dishes, legacy orders without addressComponents, various OrderStatus states), mock Firestore responses, mock Razorpay payment objects, mock Borzo API responses |
| **Unit Test Agent** | Target ≥ 80% coverage. Priority files: `menu.ts` (price recomputation, extra-meat budget enforcement, `resolveUnitPrice`, `recomputeOrderTotals`, `reconcileExtraMeatLines`), `cart-context.tsx` (add/remove/setQuantity with reconciliation), `whatsapp.ts` (message builders, phone normalization), `porterDeepLink.ts` (clipboard data extraction, phone normalization), `order-dates.ts` (meal slot/date logic), `sanitize.ts` |
| **Integration Test Agent** | Test component interactions: BiryaniPicker → CartContext (add biryani + extra meat → remove biryani → verify addon is dropped), checkout flow (cart items → server-side price recomputation → Razorpay order creation), admin status change → WhatsApp link generation, Borzo booking → deliveryMeta update → status transition |
| **Regression Test Agent** | Map every functional requirement above to at least one test. Key scenarios: (1) orphaned addon prevention, (2) price tampering rejection by server, (3) extra-meat budget cap enforcement, (4) status-gated WhatsApp buttons, (5) phone number normalization edge cases, (6) address fallback (structured vs legacy), (7) forward-only status transitions |

#### Testing Edge Cases to Cover

**Cart & Pricing:**
- Add biryani + extra meat → remove biryani → extra meat line must be dropped
- Add biryani + extra meat → reduce biryani qty → extra meat must be clamped to new cap
- Add two biryani lines (same meat, different weights) → remove one → addon budget recalculated from survivor
- `recomputeOrderTotals` rejects when extra meat exceeds weight-tier cap
- `recomputeOrderTotals` rejects unknown menuId
- `recomputeOrderTotals` rejects zero or negative quantities
- Variant-priced dish: correct price resolved per selected variant label
- Packaging fee: `totalUnits * 20` (quantity-based, not line-based)

**Authentication & Authorization:**
- Unauthenticated user cannot access `/admin` or `/checkout`
- Non-admin authenticated user sees "Admins only" on `/admin`
- Admin user can read all orders and update status

**Payment:**
- Server-side price recomputation matches client-side total for legitimate orders
- Tampered client prices are overridden by server recomputation
- Razorpay webhook with valid signature updates order payment status
- Razorpay webhook with invalid signature is rejected

**WhatsApp:**
- `waLinkToKitchen` produces URL with `BUSINESS.phoneIntl` from config (no hardcoded number)
- `waLinkToCustomer` produces URL with customer's phone in international format
- `phoneToIntl` handles "+91 96068 88096" → "919606888096"
- `buildOrderMessage` includes all order fields (items, address, totals)
- Status-specific templates render correctly for each `OrderStatus`

**Delivery:**
- `toPorterPhone` normalizes "+91 96068 88096" → "9606888096" (10 digits)
- `toPorterPhone` handles already-10-digit input
- `toPorterPhone` handles 12-digit input starting with 91
- `buildPorterClipboardData` uses structured address when available
- `buildPorterClipboardData` falls back to legacy `deliveryAddress`
- `buildPorterClipboardData` shows "—" for missing building details
- Borzo booking mock mode does not trigger WhatsApp auto-open

**Address:**
- Structured `addressComponents` includes all required fields
- Legacy `deliveryAddress` fallback renders in admin and checkout
- Missing landmark is handled gracefully

### Phase 8: Security — What to Execute

The Security stage agent (`stage-security`) should dispatch all 4 subagents:

| Subagent | Focus Area for Raku's Kitchen |
|----------|-------------------------------|
| **Secret Scanner** | Scan all source files for hardcoded API keys, Firebase config values in non-env files, Razorpay secrets, Borzo tokens, any phone numbers used as auth. Verify `.env.local` is gitignored. Check that server-only secrets are never exposed to client bundles. |
| **Dependency Scanner** | Audit `package.json` + `package-lock.json` for known CVEs. Check `firebase`, `firebase-admin`, `next`, `razorpay`, `react`, `react-dom` versions. Flag any outdated packages with known vulnerabilities. |
| **OWASP Reviewer** | Review for OWASP Top 10 issues: (1) Injection — check Firestore query construction, sanitize.ts effectiveness; (2) Broken Auth — verify Firebase Auth phone OTP flow, admin role enforcement; (3) Sensitive Data Exposure — verify server-only API keys, Razorpay webhook secret handling; (4) Broken Access Control — verify Firestore rules enforce customer-own-orders and admin-only-writes; (5) Security Misconfiguration — check CORS, CSP headers, Next.js security headers; (6) XSS — check for dangerouslySetInnerHTML, unsanitized user input rendering; (7) SSRF — check Ola Maps and Borzo API proxy routes for open redirect/SSRF |
| **Policy Validator** | Validate: (1) All API keys loaded from environment variables, not hardcoded; (2) `server-only` package correctly prevents server modules from leaking to client; (3) Firestore security rules match documented access patterns; (4) Razorpay webhook signature verification is present and correct; (5) Rate limiting considerations for API routes; (6) HTTPS enforcement; (7) No PII logged to console in production |

#### Security-Specific Concerns

**Payment Security:**
- Razorpay `KEY_SECRET` and `WEBHOOK_SECRET` must never appear in client bundles
- Server-side price recomputation must be the source of truth (client prices ignored)
- Webhook signature verification must reject tampered payloads

**Firebase Security:**
- `NEXT_PUBLIC_*` Firebase config is intentionally client-side (standard Firebase pattern)
- `firebase-admin` must only be imported in server-side code (enforced by `server-only`)
- Firestore rules must enforce: customers read own orders, admins read/write all, no public access

**API Route Security:**
- `/api/payments/create-order` — must authenticate caller, recompute prices server-side
- `/api/payments/verify` — must verify Razorpay signature
- `/api/payments/webhook` — must verify webhook signature from Razorpay
- **`/api/delivery/borzo` — SECURITY BUG: no authentication check (should be admin-only)**
- **`/api/maps/*` — SECURITY CONCERN: proxy routes have no authentication, exposing maps quota; potential SSRF if URL construction is unsafe**

**Client-Side Security:**
- No `dangerouslySetInnerHTML` usage ✓ (verified: none found in codebase)
- User input (names, addresses, notes) sanitized only by Firestore `undefined` stripping — **no XSS/injection protection layer currently**
- Phone numbers validated before use in wa.me links
- localStorage cart data treated as untrusted on load (try/catch, type validation)

**Missing Security Measures (current gaps to address in security testing):**
- **No test framework configured** — security testing phase will need to set up Jest/Vitest
- **No Content Security Policy or other security headers** in Next.js config
- **No rate limiting** on API routes 
- **No input sanitization** for XSS/injection protection (only Firestore `undefined` stripping exists)
- `/api/delivery/borzo` has no authentication
- `/api/maps/*` routes have no authentication (quota exposure risk)

## Out of Scope

- Problem Discovery, Product, Story-Tasks, Architecture, Design, Development, Review, DevOps, Observability, Retirement phases — all disabled
- Frontend UI/UX redesign
- New feature development
- CI/CD pipeline setup
- Performance optimization
- Database migration
- Deployment configuration
- Mobile app development
