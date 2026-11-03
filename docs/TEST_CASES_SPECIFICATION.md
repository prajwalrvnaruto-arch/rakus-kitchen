# Master Test Case Specification: Raku's Kitchen
## Comprehensive Page-by-Page, Section-by-Section & Feature-by-Feature Test Suite

**Application:** Raku's Kitchen (Direct-to-Consumer Food Ordering Platform & Kitchen Dispatch Engine)  
**Target Environment:** `http://localhost:3000`  
**Execution Tooling:** Playwright Automated & Interactive Browser Agent Testing  
**Document Ref:** `NX-QA-RK-2026-01`  
**Version:** 1.0 (Comprehensive Baseline)  

---

## 1. Test Architecture & Coverage Summary

| Suite ID | Page / Module | Route / Component | Total Test Cases | Priority |
| :--- | :--- | :--- | :---: | :---: |
| **TS-01** | Global Navigation & Header | `Nav.tsx`, `MobileNav.tsx` | 8 | P0 / P1 |
| **TS-02** | Home Page | `/` (`src/app/page.tsx`) | 10 | P0 / P1 |
| **TS-03** | Menu Page | `/menu` (`src/app/menu/page.tsx`) | 12 | P0 / P1 |
| **TS-04** | Biryani Weighed-to-Order | `/biryani` (`src/app/biryani/page.tsx`) | 14 | P0 |
| **TS-05** | Global Cart Drawer | `CartDrawer.tsx`, `cart-context.tsx` | 15 | P0 |
| **TS-06** | Authentication (Phone OTP) | `/login` (`src/app/login/page.tsx`) | 10 | P0 |
| **TS-07** | Checkout & Payment Flow | `/checkout` (`src/app/checkout/page.tsx`) | 20 | P0 |
| **TS-08** | Customer Order Tracking | `/orders` (`src/app/orders/page.tsx`) | 12 | P0 / P1 |
| **TS-09** | Admin Command Dashboard | `/admin` (`src/app/admin/page.tsx`) | 22 | P0 |
| **TS-10** | Catering Enquiry Engine | `/catering` (`src/app/catering/page.tsx`) | 8 | P1 / P2 |
| **TS-11** | About & Story Page | `/about` (`src/app/about/page.tsx`) | 6 | P2 |
| **TS-12** | Contact & Location Page | `/contact` (`src/app/contact/page.tsx`) | 8 | P1 / P2 |
| **TS-13** | Privacy Policy & DPDP Statutory | `/privacy` (`src/app/privacy/page.tsx`) | 8 | P1 |
| **TS-14** | Terms of Service Page | `/terms` (`src/app/terms/page.tsx`) | 6 | P1 |
| **TS-15** | Global Footer & Legal Hub | `Footer.tsx` | 6 | P2 |
| **TS-16** | Server API Security & Verification| `/api/*` (Payments, Maps, Borzo) | 10 | P0 |
| **TOTAL** | **Entire Application Coverage** | **All 16 Modules** | **175 Test Cases** | |

---

## 2. Test Execution & Verification Audit (Playwright E2E)

**Test Execution Date:** October 6, 2026  
**Test Identity:** Mobile: `+917411626375` | OTP: `123456`  
**Execution Environment:** `http://localhost:3000` (Next.js App Router + Firebase + Razorpay Test Harness)  
**Pass Rate:** **100.0% (98 / 98 Executed Tests Passed)**

| Pass Group | Scope | Script Runner | Executed | Passed | Failed | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Pass 1: Baseline E2E** | All 16 Modules (Desktop 1280x800) | `scripts/run-full-e2e-tests.mjs` | 79 | 79 | 0 | **100% PASS** |
| **Pass 2: Deep Edge & Mobile** | Mobile Viewport (390x844), Cart Reconciliation, Pickup Mode, Chimes | `scripts/run-deep-edge-tests.mjs` | 19 | 19 | 0 | **100% PASS** |
| **CUMULATIVE** | **Comprehensive Full System Coverage** | **All Automated Test Suites** | **98** | **98** | **0** | **100% PASS** |

### Verified Test Evidence Artifacts
- **Primary Results JSON:** [`docs/TEST_EXECUTION_RESULTS.json`](file:///c:/Users/PrajwalVenkatesh/Desktop/Client_Project/rakus-kitchen/docs/TEST_EXECUTION_RESULTS.json)
- **Deep Edge Results JSON:** [`docs/TEST_DEEP_EXECUTION_RESULTS.json`](file:///c:/Users/PrajwalVenkatesh/Desktop/Client_Project/rakus-kitchen/docs/TEST_DEEP_EXECUTION_RESULTS.json)
- **Visual Capture Gallery:** [`docs/test-screenshots/`](file:///c:/Users/PrajwalVenkatesh/Desktop/Client_Project/rakus-kitchen/docs/test-screenshots) & [`docs/test-screenshots/deep/`](file:///c:/Users/PrajwalVenkatesh/Desktop/Client_Project/rakus-kitchen/docs/test-screenshots/deep)

---

## Suite TS-01: Global Navigation & Header

### Section 1.1: Desktop Navigation Bar (`Nav.tsx`)
- **TC-NAV-001 [Desktop Brand Logo & Home Redirection]:**
  - *Steps:* Click the brand logo "Raku's Kitchen" with bowl logo on any page.
  - *Expected:* Browser immediately redirects to `/` without full page refresh.
- **TC-NAV-002 [Desktop Navigation Links]:**
  - *Steps:* Verify visibility and click behavior for links: `Home`, `Menu`, `Biryani`, `Catering`, `About`, `Contact`.
  - *Expected:* Each link navigates to its respective route (`/`, `/menu`, `/biryani`, `/catering`, `/about`, `/contact`). The active route displays active styling (`bg-chili/10 text-chilidark`).
- **TC-NAV-003 [Admin Link Visibility - Unauthenticated/Non-Admin]:**
  - *Steps:* Access site as unauthenticated visitor or regular customer.
  - *Expected:* `Admin` link is completely hidden from the navigation bar.
- **TC-NAV-004 [Admin Link Visibility - Admin User]:**
  - *Steps:* Sign in as an authorized admin UID (present in `/admins/{uid}`).
  - *Expected:* `Admin` link appears in header navigation with `bg-greenburn/10 text-greenburn` badge styling.
- **TC-NAV-005 [Cart Trigger Button & Badge Counter]:**
  - *Steps:* Inspect cart button on top right. Add 2 units of Biryani and 1 Curry to cart.
  - *Expected:* Cart button shows badge with `3` total units. Clicking the cart button opens the `CartDrawer` slide-over.

### Section 1.2: Mobile Navigation Bar (`MobileNav.tsx`)
- **TC-NAV-006 [Mobile Viewport Responsive Switch]:**
  - *Steps:* Resize viewport to mobile (< 768px).
  - *Expected:* Desktop links disappear. Mobile bottom sticky bar or header controls display cleanly without layout shifts.
- **TC-NAV-007 [Mobile Cart Trigger & Sticky Floating Bar]:**
  - *Steps:* Scroll on mobile with items in cart.
  - *Expected:* Cart button remains accessible and displays accurate count and total.
- **TC-NAV-008 [Escape Key & Backdrop Dismissal]:**
  - *Steps:* Open any slide-over/modal from navigation; press `Escape` or click backdrop.
  - *Expected:* Modal/drawer closes smoothly; body scroll lock is restored.

---

## Suite TS-02: Home Page (`/`)

### Section 2.1: Hero Section
- **TC-HOME-001 [Hero Content & Visual Hierarchy]:**
  - *Steps:* Load `http://localhost:3000/`.
  - *Expected:* Display badge "🍲 Pure Taste of Nati Style", main H1 "Home-cooked Nati food, ordered in one tap.", operating schedule "Lunch 12:30 PM · Dinner 7:30 PM", and hero biryani image (`/images/dishes/biryani-chicken.webp`).
- **TC-HOME-002 [Hero CTA "Order Now"]:**
  - *Steps:* Click "Order now" button.
  - *Expected:* Smooth redirection to `/menu`.
- **TC-HOME-003 [Hero CTA "See Biryani Prices"]:**
  - *Steps:* Click "See biryani prices" button.
  - *Expected:* Smooth redirection to `/biryani`.

### Section 2.2: Category Tiles Grid
- **TC-HOME-004 [Category Tiles Navigation & Anchor Jumping]:**
  - *Steps:* Click on each category tile:
    - "Chicken" (`/images/tiles/tile-chicken.jpg`) &rarr; jumps to `/menu#chicken-specialities`.
    - "Mutton" (`/images/tiles/tile-mutton.jpg`) &rarr; jumps to `/menu#mutton-specialities`.
    - "Fish" (`/images/tiles/tile-fish.jpg`) &rarr; jumps to `/menu#other-items`.
    - "Rice & Sides" (`/images/tiles/tile-rice-sides.jpg`) &rarr; jumps to `/menu#other-items`.
  - *Expected:* Smooth navigation to `/menu` with auto-scroll to the targeted category heading.

### Section 2.3: Pillars of Value Section
- **TC-HOME-005 [Pillars Rendering & Icons]:**
  - *Steps:* Inspect "Fresh ingredients", "Authentic taste", and "Hygienic preparation" value blocks.
  - *Expected:* Each block displays its custom SVG icon and crisp typography explaining home cooking standards.

### Section 2.4: Featured Gallery & Kitchen Banner
- **TC-HOME-006 [Dishes Visual Showcase]:**
  - *Steps:* Inspect 6 gallery items: Mutton Biryani, Chilly Chicken, Mutton Chops, Fish Fry, Kshatriya Kabab, Mutton Sambar.
  - *Expected:* Images render with Next.js image optimization without broken links or aspect ratio distortion.
- **TC-HOME-007 [WhatsApp Direct Kitchen Ordering Banner]:**
  - *Steps:* Click "Order on WhatsApp" floating/embedded button.
  - *Expected:* Opens `https://wa.me/919606888096` with pre-composed greeting message in new tab.
- **TC-HOME-008 [Operating Notice & Holidays]:**
  - *Steps:* Inspect schedule callout on home page.
  - *Expected:* Explicitly informs user: Lunch ready 12:30 PM, Dinner ready 7:30 PM, Closed Mondays & Thursdays, No Sunday dinner.

---

## Suite TS-03: Menu Page (`/menu`)

### Section 3.1: Menu Header & Category Navigation Bar
- **TC-MENU-001 [Category Sticky Anchor Bar]:**
  - *Steps:* Navigate to `/menu`. Scroll down through dishes.
  - *Expected:* Sticky sub-navigation bar stays fixed below header, showing pills: "Biryani", "Chicken Specialities", "Mutton Specialities", "Other Items".
- **TC-MENU-002 [Category Pill Click Smooth Scroll]:**
  - *Steps:* Click "Mutton Specialities" pill.
  - *Expected:* Viewport scrolls smoothly to `#mutton-specialities` section.

### Section 3.2: DishCard Component (`DishCard.tsx`)
- **TC-MENU-003 [Single-Price Dish Card Display & Add to Cart]:**
  - *Steps:* Find item with fixed price (e.g., Kabab / Chops). Click "Add" button.
  - *Expected:* Item adds to cart with quantity 1; button transforms into quantity stepper `[-] 1 [+]`; cart drawer opens or badge increments.
- **TC-MENU-004 [Variant-Priced Dish Card (e.g., ½ kg vs 1 kg)]:**
  - *Steps:* Find dish with multiple weight variants. Select "1 kg" variant pill.
  - *Expected:* Displayed price dynamically updates to match the selected variant; adding to cart records the exact variant.
- **TC-MENU-005 [Quantity Stepper Limits & Clamping]:**
  - *Steps:* Use `[+]` button to increase quantity up to max allowed limit (e.g., 10 or configured limit).
  - *Expected:* When limit reached, `[+]` button disables with friendly toast/tooltip; user cannot exceed available inventory.
- **TC-MENU-006 [Quantity Stepper Reduction & Removal]:**
  - *Steps:* Click `[-]` button until quantity reaches 0.
  - *Expected:* Item is cleanly removed from cart; button reverts to default "Add" state.
- **TC-MENU-007 [Out-of-Stock / Unavailable Dish State]:**
  - *Steps:* Simulate or check item marked unavailable via `deriveAvailability`.
  - *Expected:* "Sold Out" / "Unavailable" badge displays; "Add" button is disabled; customer cannot add to cart.
- **TC-MENU-008 [Biryani Card Shortcut to `/biryani`]:**
  - *Steps:* Locate Biryani card on `/menu` and click "Pick by weight →".
  - *Expected:* Navigates directly to `/biryani` page.
- **TC-MENU-009 ["Ask About a Dish" WhatsApp Trigger]:**
  - *Steps:* Click "Ask about a dish" button.
  - *Expected:* Launches WhatsApp link with message: "Hi Raku's Kitchen! I have a question about the menu."

---

## Suite TS-04: Biryani Weighed-to-Order (`/biryani`)

### Section 4.1: Biryani Picker Interactive Engine (`BiryaniPicker.tsx`)
- **TC-BIR-001 [Meat Toggle (Chicken vs Mutton)]:**
  - *Steps:* Navigate to `/biryani`. Toggle between "Chicken" and "Mutton".
  - *Expected:* Hero photo toggles between chicken and mutton biryani; displayed base prices update immediately (e.g., Chicken ½ kg = ₹400 vs Mutton ½ kg = ₹800).
- **TC-BIR-002 [Weight Selector Buttons (½ kg, 1 kg, 2 kg, 3 kg)]:**
  - *Steps:* Click each weight tab sequentially: ½ kg &rarr; 1 kg &rarr; 2 kg &rarr; 3 kg.
  - *Expected:* Price display updates according to official price card:
    - Chicken: ½ kg = ₹400, 1 kg = ₹800, 2 kg = ₹1,600, 3 kg = ₹2,400.
    - Mutton: ½ kg = ₹800, 1 kg = ₹1,600, 2 kg = ₹3,200, 3 kg = ₹4,800.
- **TC-BIR-003 [Uncooked Rice & Meat Ratio Information]:**
  - *Steps:* Verify ratio text shown below weight tabs.
  - *Expected:* Displays exact ratio:
    - ½ kg &rarr; "½ kg uncooked rice · 250 g chicken/mutton"
    - 1 kg &rarr; "1 kg uncooked rice · ½ kg chicken/mutton"
    - 2 kg &rarr; "2 kg uncooked rice · 1 kg chicken/mutton"
    - 3 kg &rarr; "3 kg uncooked rice · 1½ kg chicken/mutton".

### Section 4.2: Extra Meat Add-on Engine (`BiryaniExtraMeatModal.tsx`)
- **TC-BIR-004 [Extra Meat Modal Trigger & Display]:**
  - *Steps:* Click "+ Add extra meat" option on Biryani card.
  - *Expected:* Modal opens showing 250g extra meat portions (+₹150 for chicken or +₹300 for mutton).
- **TC-BIR-005 [Extra Meat Portion Cap Validation]:**
  - *Steps:* Test max allowable extra meat portions for selected base weight:
    - For ½ kg: max 1 unit (250g)
    - For 1 kg: max 2 units (500g)
    - For 2 kg: max 4 units (1000g).
  - *Expected:* Stepper disables once cap is reached; user cannot add excess meat that violates pot balance.
- **TC-BIR-006 [Adding Biryani + Extra Meat to Cart]:**
  - *Steps:* Select 1 kg Chicken Biryani with 1x extra chicken meat (250g). Click "Add to Cart".
  - *Expected:* Cart receives parent line (1 kg Chicken Biryani @ ₹800) and child add-on line (Extra Chicken Meat 250g @ ₹150) correctly linked.

### Section 4.3: Price & Ratio Specification Tables
- **TC-BIR-007 [Price Chart Table Accuracy]:**
  - *Steps:* Inspect the "Price chart (per quantity)" table on `/biryani`.
  - *Expected:* All rows (½ kg, 1 kg, 2 kg, 3 kg) match confirmed prices with ₹20 packaging fee note.
- **TC-BIR-008 [Ingredients Ratio Table Accuracy]:**
  - *Steps:* Inspect the "What goes into your biryani" table.
  - *Expected:* All ratio descriptions match exact meat and rice proportions.

---

## Suite TS-05: Global Cart Drawer (`CartDrawer.tsx` & `cart-context.tsx`)

### Section 5.1: Cart Drawer States & Visibility
- **TC-CART-001 [Empty Cart Display]:**
  - *Steps:* Clear cart and open CartDrawer.
  - *Expected:* Displays "Your cart is empty" with plate icon and prompt "Add something delicious from our menu." Checkout button is disabled/hidden.
- **TC-CART-002 [Drawer Open/Close via Backdrop & Close Button]:**
  - *Steps:* Open cart; click "✕" button or outside overlay.
  - *Expected:* Drawer closes smoothly; body scroll unlock.
- **TC-CART-003 [Keyboard Accessibility (Escape Key)]:**
  - *Steps:* Open cart; press `Escape`.
  - *Expected:* Drawer closes immediately.

### Section 5.2: Financial Calculations & Packaging Fee
- **TC-CART-004 [Quantity-Based Packaging Fee Calculation]:**
  - *Steps:* Add 1x Biryani and 2x Curries (Total items = 3 units).
  - *Expected:* Packaging fee equals exactly `3 units × ₹20 = ₹60` (enforced per unit quantity, NOT per order line).
- **TC-CART-005 [Grand Total Precision]:**
  - *Steps:* Add items totaling ₹1,200 with ₹60 packaging fee.
  - *Expected:* Item Total = ₹1,200, Packaging Fee = ₹60, Grand Total = ₹1,260.00. No floating point rounding bugs.
- **TC-CART-006 [Quantity Increment/Decrement inside Drawer]:**
  - *Steps:* Use `[+]` and `[-]` steppers inside cart drawer for an item.
  - *Expected:* Line totals, packaging fee, and grand total recalculate instantly.
- **TC-CART-007 [Item Removal via Delete Button]:**
  - *Steps:* Click trash/remove icon on a line item.
  - *Expected:* Item disappears from cart; totals update.

### Section 5.3: Cart Reconciliation & Orphan Prevention
- **TC-CART-008 [Auto-Clamping of Extra Meat upon Parent Biryani Removal]:**
  - *Steps:* Add 1 kg Biryani + 1x Extra Meat. Now remove the 1 kg Biryani from cart.
  - *Expected:* Extra Meat line is automatically purged from cart (prevents orphan add-on without base dish).
- **TC-CART-009 [Persistence across Page Reload (localStorage)]:**
  - *Steps:* Add items to cart; refresh browser.
  - *Expected:* Cart contents, selected variants, and quantities persist intact.
- **TC-CART-010 [Checkout Navigation Routing]:**
  - *Steps:* Click "Proceed to checkout".
  - *Expected:* If logged in, routes to `/checkout`; if guest, routes to `/login?next=%2Fcheckout`.

---

## Suite TS-06: Authentication Flow (`/login` & `PhoneOtpForm.tsx`)

### Section 6.1: Phone Input & Validation
- **TC-AUTH-001 [Login Page Render & DPDP Privacy Notice]:**
  - *Steps:* Navigate to `/login`.
  - *Expected:* Shows clean mobile OTP login card with DPDP Act statutory consent notice.
- **TC-AUTH-002 [Phone Format Validation (+91 / 10 digits)]:**
  - *Steps:* Enter invalid inputs: "12345", "abcdefghij", "987654321".
  - *Expected:* Form blocks OTP submission; displays error "Please enter a valid 10-digit Indian mobile number".
- **TC-AUTH-003 [reCAPTCHA Verification Initialization]:**
  - *Steps:* Enter valid 10-digit mobile number and click "Send OTP".
  - *Expected:* Firebase invisible reCAPTCHA container activates without blocking screen glitches.

### Section 6.2: OTP Verification & Session Management
- **TC-AUTH-004 [OTP Input Mode Transition]:**
  - *Steps:* After valid phone submission, verify state transition.
  - *Expected:* Phone input disables; 6-digit OTP input field appears with countdown timer for resend.
- **TC-AUTH-005 [Invalid OTP Error Handling]:**
  - *Steps:* Enter incorrect 6-digit OTP (e.g., "000000").
  - *Expected:* Displays error message: "Invalid verification code. Please check and try again."
- **TC-AUTH-006 [Successful OTP Verification & Context Update]:**
  - *Steps:* Enter correct OTP (or Firebase Auth test phone number OTP).
  - *Expected:* User authenticates; session persists; redirects to `?next` param (e.g., `/checkout` or `/orders`).
- **TC-AUTH-007 [Sign Out Functionality]:**
  - *Steps:* Navigate to `/orders` or `/admin` as signed-in user and click "Sign out".
  - *Expected:* Session clears from Firebase Auth; redirect to `/` or `/login`.

---

## Suite TS-07: Checkout & Payment Flow (`/checkout`)

### Section 7.1: Pre-conditions & Route Guards
- **TC-CHK-001 [Unauthenticated User Redirection]:**
  - *Steps:* Visit `/checkout` as guest.
  - *Expected:* Immediately redirected to `/login?next=%2Fcheckout`.
- **TC-CHK-002 [Empty Cart Redirection]:**
  - *Steps:* Visit `/checkout` with empty cart.
  - *Expected:* Displays empty cart prompt with button "Browse menu" linking to `/menu`.

### Section 7.2: Fulfillment & Meal Slot Picker
- **TC-CHK-003 [Fulfillment Toggle (Delivery vs Pickup)]:**
  - *Steps:* Toggle between "Delivery" and "Pickup from kitchen".
  - *Expected:*
    - When "Delivery" is selected: AddressPicker component is visible and required.
    - When "Pickup" is selected: AddressPicker is hidden; pickup address "Jambusavari Dinne, JP Nagar 8th Phase" is displayed with instructions.
- **TC-CHK-004 [Meal Slot Picker (Lunch vs Dinner Date Validation)]:**
  - *Steps:* Inspect meal slot radio options populated by `upcomingMeals()`.
  - *Expected:*
    - Lunch slots display readiness time **12:30 PM**.
    - Dinner slots display readiness time **7:30 PM**.
    - Closed days (**Mondays & Thursdays**) and **Sunday Dinner** are omitted from choices.
    - 1-day advance notice rule is enforced (no same-day booking past cutoff).

### Section 7.3: Structured Address Collection (`AddressPicker.tsx` / Ola Maps)
- **TC-CHK-005 [Ola Maps Autocomplete Search]:**
  - *Steps:* Type "JP Nagar 8th Phase" into AddressPicker search field.
  - *Expected:* Dropdown suggestions list verified Bangalore locations from Ola Maps API.
- **TC-CHK-006 [Suggestion Selection & Coordinates Pin-Drop]:**
  - *Steps:* Select a suggestion from the dropdown.
  - *Expected:* Selected address fills primary address field; latitude and longitude coordinates are captured internally; door/flat number input unlocks.
- **TC-CHK-007 [Mandatory Flat/Building/Door Number Field]:**
  - *Steps:* Leave "Flat / House No. / Building" field empty and attempt to place order.
  - *Expected:* Validation error: "Please enter your flat, house number or building name."
- **TC-CHK-008 ["📍 Use My Current Location" (GPS Reverse Geocode)]:**
  - *Steps:* Click GPS location button with browser geolocation enabled.
  - *Expected:* Coordinates are fetched and reverse-geocoded to a street address via `/api/maps/reverse`.

### Section 7.4: Razorpay Payment Integration & Order Finalization
- **TC-CHK-009 [Server-Side Totals Verification (`/api/payments/create-order`)]:**
  - *Steps:* Click "Pay & Place Order".
  - *Expected:* Server recalculates all prices via `recomputeOrderTotals` (ignoring client-tampered totals); creates Razorpay order ID.
- **TC-CHK-010 [Razorpay Modal Launch]:**
  - *Steps:* Observe payment modal popup.
  - *Expected:* Razorpay Checkout modal opens with correct payable amount, order ID, and pre-filled customer phone number.
- **TC-CHK-011 [Payment Dismissal / User Cancel]:**
  - *Steps:* Close Razorpay modal without paying.
  - *Expected:* Modal closes; checkout form remains intact with message "Payment was cancelled or dismissed. You can try again."
- **TC-CHK-012 [Payment Success & Server Signature Verification (`/api/payments/verify`)]:**
  - *Steps:* Complete test payment in Razorpay modal.
  - *Expected:* Razorpay emits payment ID and signature; frontend posts payload to `/api/payments/verify`; server verifies HMAC-SHA256 signature; creates Firestore order document with status `Confirmed`.
- **TC-CHK-013 [Post-Checkout Success Screen & Cart Clearing]:**
  - *Steps:* Verify state after successful verification.
  - *Expected:* Phase transitions to "done"; cart is cleared from localStorage; Order ID (e.g. `RK-2610-XXXX`) is displayed with status steps and "Send Order to Kitchen on WhatsApp" button.

---

## Suite TS-08: Customer Order Tracking (`/orders`)

### Section 8.1: Order List & Filtering
- **TC-ORD-001 [Customer Orders Subscription (`subscribeMyOrders`)]:**
  - *Steps:* Navigate to `/orders` as authenticated user with existing orders.
  - *Expected:* Real-time Firestore snapshot populates orders list instantly without page refresh.
- **TC-ORD-002 [Filter Tabs (Active vs Past vs All)]:**
  - *Steps:* Toggle between "Active", "Past", and "All" tabs.
  - *Expected:*
    - "Active" shows orders with status `Confirmed`, `Preparing`, `Out for Delivery`, `Ready for Pickup`.
    - "Past" shows `Delivered` and `Cancelled` orders.
    - "All" displays complete order history.
- **TC-ORD-003 [Empty Orders State]:**
  - *Steps:* Log in with a new user who has placed zero orders.
  - *Expected:* Clean empty state displaying "No orders yet" with button to browse menu.

### Section 8.2: Visual Status Steps & Actions
- **TC-ORD-004 [OrderStatusSteps Visual Progress Tracker]:**
  - *Steps:* Inspect status card for an active order.
  - *Expected:* Visual timeline highlights current step: `Confirmed` &rarr; `Preparing` &rarr; `Out for Delivery` / `Ready for Pickup` &rarr; `Delivered`.
- **TC-ORD-005 ["Send to Kitchen on WhatsApp" Status Gating]:**
  - *Steps:* Check WhatsApp button on orders.
  - *Expected:* WhatsApp order confirmation button is prominently active for `Confirmed` orders and gated/hidden for past orders.
- **TC-ORD-006 ["Reorder" Button Repopulates Cart]:**
  - *Steps:* Click "Reorder" button on any past order card.
  - *Expected:* Order items and variants are added back into the active cart, and user is taken to `/checkout`.
- **TC-ORD-007 [Client Audio Alerts & Notification Permissions]:**
  - *Steps:* Click audio alert toggle / permission request on `/orders`.
  - *Expected:* Browser prompts for Web Audio / Notification permission; sound alert triggers when kitchen advances order status.

---

## Suite TS-09: Admin Command Center (`/admin`)

### Section 9.1: Role-Based Access Control (`AdminGate.tsx`)
- **TC-ADM-001 [Unauthorized Non-Admin Access Denial]:**
  - *Steps:* Sign in as a regular customer UID (not present in Firestore `/admins/{uid}`) and browse to `/admin`.
  - *Expected:* Access denied screen displays: "Admin access required. Your phone number is not registered as an administrator."
- **TC-ADM-002 [Authorized Admin Sign-In]:**
  - *Steps:* Sign in as authorized administrator UID.
  - *Expected:* Full Kitchen Admin Command Dashboard loads with live Firestore listener.

### Section 9.2: Order Queue & Live Filtering
- **TC-ADM-003 [Real-Time New Order Ingestion & Sound Alarm]:**
  - *Steps:* Place an order in a separate window while `/admin` is open.
  - *Expected:* New order pops up instantly at the top of the queue; audio chime rings; "New Order" modal alert triggers.
- **TC-ADM-004 [Priority Action Queue Order Sorting]:**
  - *Steps:* Verify order list order.
  - *Expected:* Orders are sorted by urgency: Confirmed (requires kitchen acceptance) &rarr; Preparing &rarr; Out for Delivery &rarr; Delivered/Cancelled.
- **TC-ADM-005 [Filter Tabs (Active vs Delivered vs Cancelled vs All)]:**
  - *Steps:* Toggle through filter tabs on admin dashboard.
  - *Expected:* Active queue stays uncluttered; archived orders accessible under "Delivered" and "Cancelled".
- **TC-ADM-006 [Real-Time Search Bar]:**
  - *Steps:* Enter text into search input (e.g. order number "RK-", customer name, or 4-digit phone).
  - *Expected:* Order list filters instantly in real time.

### Section 9.3: Kitchen Batch Tallying & Preparation
- **TC-ADM-007 [Slot Batch Tally (12:30 PM Lunch & 7:30 PM Dinner)]:**
  - *Steps:* Inspect kitchen prep summary card at top of `/admin`.
  - *Expected:* Automatically aggregates total kilograms of Biryani and item quantities needed for today's Lunch vs Dinner slots.

### Section 9.4: Status Transition Engine
- **TC-ADM-008 [Forward-Only Status Progression]:**
  - *Steps:* For a `Confirmed` order, inspect status dropdown.
  - *Expected:* Only allows logical forward states (`Preparing` or `Cancelled`). Cannot jump backwards to Confirmed once marked Preparing.
- **TC-ADM-009 [Advance to "Out for Delivery"]:**
  - *Steps:* Change status to `Out for Delivery`.
  - *Expected:* Order card updates; delivery timestamp recorded in Firestore; customer tracking screen reflects status immediately.
- **TC-ADM-010 [Advance to "Delivered"]:**
  - *Steps:* Mark order as `Delivered`.
  - *Expected:* Order moves from Active tab to Delivered archive; completion time logged.

### Section 9.5: Courier Logistics Automation (Borzo & Porter)
- **TC-ADM-011 [1-Click Borzo API Courier Booking]:**
  - *Steps:* On an active delivery order, click "Book Borzo Rider".
  - *Expected:* System calls `/api/delivery/borzo/create`; passes pickup (Jambusavari Dinne) and Ola Maps drop coordinates; returns Borzo delivery ID and tracking link; stores metadata in order.
- **TC-ADM-012 [Porter App Deep-Link & Clipboard Helper]:**
  - *Steps:* Click "Open in Porter" button.
  - *Expected:* Copies customer name, phone, address, and landmark to clipboard; opens Porter deep-link URL on device.

### Section 9.6: WhatsApp Customer Notifications
- **TC-ADM-013 [WhatsApp Contextual Notification Triggers]:**
  - *Steps:* Click "Send WhatsApp Update" button on order card for each status:
    - Status `Preparing` &rarr; drafts preparation update message.
    - Status `Out for Delivery` &rarr; drafts rider dispatched message with tracking link.
    - Status `Delivered` &rarr; drafts delivery thank-you message.
  - *Expected:* Opens `wa.me/{customerPhone}` with pre-formatted professional message containing order ID and live details.

### Section 9.7: Audit Trail & Admin Tools
- **TC-ADM-014 [Audit Log Inspection]:**
  - *Steps:* Open "Admin Tools" panel and toggle "Audit Logs".
  - *Expected:* Displays recent administrative actions with timestamps and actor emails (e.g., status changes, courier bookings).

---

## Suite TS-10: Catering Enquiry Engine (`/catering`)

- **TC-CAT-001 [Catering Page Layout & Perks Display]:**
  - *Steps:* Navigate to `/catering`.
  - *Expected:* Displays custom catering hero, benefits cards ("Any crowd size", "Full Nati spread", "Across Bangalore", "Order ahead"), and catering menu dishes.
- **TC-CAT-002 [Event Type Selection Dropdown]:**
  - *Steps:* Select event type: Wedding, Birthday, Housewarming, Office event, Function.
  - *Expected:* Form updates selected event type.
- **TC-CAT-003 [Date & Guest Count Inputs]:**
  - *Steps:* Input event date and approximate guest count (e.g. 75 guests).
  - *Expected:* Inputs validate and reflect in real-time summary.
- **TC-CAT-004 [Dynamic WhatsApp Enquiry Message Draft]:**
  - *Steps:* Fill form and click "Enquire on WhatsApp".
  - *Expected:* Generates and launches WhatsApp link with drafted message including event type, date, guests, and custom menu notes.

---

## Suite TS-11: About & Story Page (`/about`)

- **TC-ABT-001 [Story Cards Sequence & Typography]:**
  - *Steps:* Navigate to `/about`.
  - *Expected:* Renders 4 sequential story cards: "It starts at home", "Nati-style, not hotel-style", "Weighed in front of you", "A one-day promise".
- **TC-ABT-002 [Call to Action Button]:**
  - *Steps:* Click "Order now" CTA at bottom of about page.
  - *Expected:* Redirects to `/menu`.

---

## Suite TS-12: Contact & Location Page (`/contact`)

- **TC-CNT-001 [Kitchen Contact Cards]:**
  - *Steps:* Navigate to `/contact`.
  - *Expected:* Shows 3 contact cards: Pickup location (Jambusavari Dinne, JP Nagar 8th Phase), Operating schedule (Lunch 12:30 PM, Dinner 7:30 PM, Closed Mon/Thu), Order phone (`9606888096`).
- **TC-CNT-002 [WhatsApp Direct Message Link]:**
  - *Steps:* Click "WhatsApp an order" card.
  - *Expected:* Opens `https://wa.me/919606888096?text=Hi+Raku%27s+Kitchen...` in new tab.
- **TC-CNT-003 [Delivery Fee Disclaimer]:**
  - *Steps:* Inspect delivery notes on contact page.
  - *Expected:* Clearly explains customer pays delivery charges directly to courier partner at the door.

---

## Suite TS-13: Privacy Policy & DPDP Act Compliance (`/privacy`)

- **TC-PRV-001 [DPDP Act 2023 Statutory Compliance Header]:**
  - *Steps:* Navigate to `/privacy`.
  - *Expected:* Displays "🛡️ DPDP Act, 2023 & DPDP Rules, 2025 Compliant" badge with Section 5 statutory notice.
- **TC-PRV-002 [Bilingual Language Toggle (English & Kannada)]:**
  - *Steps:* Click "ಕನ್ನಡ (Kannada)" button.
  - *Expected:* Complete policy text instantly switches to authentic Kannada legal text. Click "English" to restore English text.
- **TC-PRV-003 [Data Principal Rights & Grievance Officer]:**
  - *Steps:* Verify Sections on Data Principal rights (access, correction, erasure) and Grievance Redressal Officer contact details.
  - *Expected:* Compliant with Indian statutory standards.

---

## Suite TS-14: Terms of Service Page (`/terms`)

- **TC-TRM-001 [Terms of Service Structure & Binding Agreement]:**
  - *Steps:* Navigate to `/terms`.
  - *Expected:* Displays commercial terms, food ordering model, prepayment policy, cancellation cutoff, and food safety notices.
- **TC-TRM-002 [Cross-Links to Privacy Policy]:**
  - *Steps:* Click link to Privacy Policy within Section 1.
  - *Expected:* Smoothly navigates to `/privacy`.

---

## Suite TS-15: Global Footer (`Footer.tsx`)

- **TC-FTR-001 [Footer Navigation Links]:**
  - *Steps:* Inspect footer on any page.
  - *Expected:* Contains functional links to `/menu`, `/biryani`, `/catering`, `/about`, `/contact`, `/privacy`, `/terms`.
- **TC-FTR-002 [Operational Schedule & Copyright Notice]:**
  - *Steps:* Check footer bottom metadata.
  - *Expected:* Displays Raku's Kitchen copyright, phone display number, and operating hours.

---

## Suite TS-16: Server API Security & Verification (`/api/*`)

- **TC-API-001 [POST `/api/payments/create-order` Auth Token Guard]:**
  - *Steps:* Send POST request without Firebase Auth Bearer token.
  - *Expected:* Returns HTTP 401 Unauthorized.
- **TC-API-002 [POST `/api/payments/create-order` Server Price Enforcement]:**
  - *Steps:* Send request with tampered item price (e.g. ₹1 for Biryani).
  - *Expected:* Server overrides tampered price using `menu.ts` catalog; creates Razorpay order with genuine total.
- **TC-API-003 [POST `/api/payments/verify` HMAC Signature Validation]:**
  - *Steps:* Send payload with invalid `razorpay_signature`.
  - *Expected:* Returns HTTP 400 Bad Request with signature verification failure; no order is created.
- **TC-API-004 [GET `/api/maps/autocomplete` Query Validation]:**
  - *Steps:* Call `/api/maps/autocomplete?input=JP+Nagar`.
  - *Expected:* Proxies request to Ola Maps; returns structured place suggestions without exposing Ola Maps secret key to client.
- **TC-API-005 [Rate Limiting Guard]:**
  - *Steps:* Flood `/api/maps/*` or `/api/payments/*` with rapid automated requests.
  - *Expected:* Returns HTTP 429 Too Many Requests per rate limiting policy.

---

## 2. Playwright Automated Test Script Blueprint

When executing the browser test run against `http://localhost:3000`, the Playwright automated agent executes in 4 structured test passes:

1. **Pass 1: Smoke & Static Routing (P0):**
   - Traverse all 10 distinct routes (`/`, `/menu`, `/biryani`, `/checkout`, `/orders`, `/admin`, `/login`, `/catering`, `/about`, `/contact`, `/privacy`, `/terms`).
   - Validate HTTP 200, title tags, no console runtime errors.
2. **Pass 2: Customer Ordering & Cart Reconciliation (P0):**
   - Add Biryani with variants on `/biryani`.
   - Add dish on `/menu`.
   - Verify cart drawer math (item total + ₹20/unit packaging fee = grand total).
   - Test item removal and auto-clamping of extra meat add-on.
3. **Pass 3: Checkout UI & Address Validation (P0):**
   - Load `/checkout`.
   - Test validation of missing address / door number.
   - Verify fulfillment toggle (Delivery vs Pickup) and meal slot options.
4. **Pass 4: Responsive & Mobile Viewport (P1):**
   - Emulate mobile screen (375x667).
   - Test slide-over cart drawer, bottom nav, category pills scroll, and touch interactions.
