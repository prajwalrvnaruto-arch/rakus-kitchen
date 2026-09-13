# Raku's Kitchen — Food Ordering Web App

A mobile-first ordering website for **Raku's Kitchen**, the Nati-style home-cooked food
and catering business at JP Nagar 8th Phase, Bangalore (IG: @rakus.kitchen).

Customers sign in with **mobile OTP**, add dishes to a cart, pick a meal day and slot,
place an order that gets a **unique Order ID (RK-00001)**, and send the order to the
kitchen on **WhatsApp (9606888096)**. The kitchen manages every order from a private
**admin dashboard** — Received → Confirmed → Preparing → Out for Delivery → Delivered —
and customers track it live in their account.

---

## Tech stack

- **Next.js 14** (App Router) + React 18 + TypeScript + Tailwind CSS
- **Firebase**: Phone Auth (OTP) + Firestore (orders & admin allowlist)
- WhatsApp notification via a `wa.me` deep link opened from the customer's phone — no API keys needed
- Deploy free on **Vercel** (or Firebase Hosting / Netlify)

## How ordering works (what the customer sees)

1. **Log in** with an email address → one-tap link (Firebase email sign-in, no password, no SMS).
2. **Browse the menu** — chicken, mutton, fish, rice & breads, sides, soups.
3. **Biryani** is chosen by weight (½kg / 1kg / 2kg / 3kg) and meat (chicken / mutton).
4. **Checkout** — pick a meal day & slot. Orders must be made **one day in advance**;
   **Mon & Thu are holidays**; Sunday dinner isn't served. Lunch ready 12:30 PM, dinner 7:30 PM.
5. **Place order** → gets a unique ID (`RK-00007`) → the app opens **WhatsApp** with the
   full order pre-typed; the customer taps send. The kitchen **calls back to confirm**.
6. **Track** the order in *My Orders* — status updates live as the kitchen moves it.

## Pricing notes

- Only **biryani** prices are confirmed by the business. Everything else in
  [`src/lib/menu.ts`](src/lib/menu.ts) has a **marked placeholder price** (`placeholder: true`)
  so the site is fully orderable — confirm each with the kitchen and remove the flag.
  Prices live in ONE file, so adjusting is a one-line change.
- **Packaging fee ₹20 per item** is charged per quantity unit (3 biryanis + 1 fry = ₹80).
  Changing the interpretation is a one-function change in `src/lib/menu.ts`
  (`packagingFeeForUnits`).
- **Delivery charges** are paid by the customer to the delivery partner; they're shown as a
  note, not added to the total (the platform fee isn't known upfront).

---

## Setup (15 minutes)

### 1. Create a Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com), create a project
   (add "Google Analytics" can be skipped).
2. **Security → Authentication → Sign-in method → Email/Password** → Enable, and tick
   **"Email link (passwordless sign-in)"** (the redesigned sidebar groups this under
   "Security"; there's no "Build" menu anymore).
3. **Databases and storage → Firestore Database → Create database** → Production mode
   (you'll paste rules next).
4. **Project settings → Your apps → Web (`</>`)** → register a web app and copy its config.

### 2. Add the config
```bash
cp .env.local.example .env.local
```
Paste the Firebase web config values into `.env.local`.

### 3. Apply database rules
In the **Firestore console → Rules**, paste the contents of
[`firestore.rules`](firestore.rules), then **Publish**.

> Also add `http://localhost:3000` to **Auth → Settings → Authorized domains**
> (it's usually pre-added) and, once live, your Vercel domain. The email magic link
> lands on `/login`, so the deployed domain must be listed there for the link to work.

### 4. (Optional) Test locally with Firebase emulators
The repo includes emulator config. You need **Java installed**, then:
```bash
npm run emulators        # starts auth :9099 + firestore :8080 + UI :4000
# in a second terminal:
NEXT_PUBLIC_EMULATOR=true npm run dev
```
In emulator mode, any phone number works and the OTP is `000000` (shown in the emulator log).
You can then test the full flow offline.

### 5. Make yourself an admin
Admins are an allowlist in Firestore: a document **`/admins/<email>`** must exist
(the key is the email the admin signs in with, exactly as typed).

- **Fastest:** in Firestore console, create collection `admins`, document id `your@email.com`,
  with a field e.g. `role: "admin"`.
- Or, from the app console (if a project is reachable):
  open a browser tab and run `setAdmin("your@email.com", true)` — import it from `@/lib/db`.
- Until this doc exists, the `/admin` page shows "Admins only".

### 6. Run it
```bash
npm install
npm run dev       # http://localhost:3000
```

### 7. Deploy to Vercel
1. Push this folder to a Git repo (GitHub/GitLab).
2. At [vercel.com/new](https://vercel.com/new), import the repo — Vercel auto-detects Next.js.
3. Add the same `.env.local` keys as **Environment Variables**:
   `NEXT_PUBLIC_FIREBASE_*` (keep `NEXT_PUBLIC_EMULATOR=false`).
4. Deploy. Add `https://your-domain` to Firebase **Auth → Authorized domains**.

---

## Editing price & text (the bits you'll touch most)

| What | Where |
|---|---|
| Biryani prices | `BIRYANI_PRICING` in `src/lib/menu.ts` |
| All other dish prices / placeholders | `MENU` array in `src/lib/menu.ts` |
| Packaging fee rule | `packagingFeeForUnits` in `src/lib/menu.ts` |
| Phone, address, ready times | `BUSINESS` in `src/lib/config.ts` |
| Holidays / Sunday-dinner rule | `src/lib/order-dates.ts` |
| WhatsApp order message | `buildOrderMessage` in `src/lib/whatsapp.ts` |

**Food photography:** real dish photos live in [`public/images/dishes/`](public/images/dishes/)
(web-optimized ~180 KB WebP, converted from the originals in `assets/`). Each menu item's
`photo` field in `src/lib/menu.ts` points at one; the UI falls back to the warm emoji tile
for items without a photo yet. To add a photo: drop a WebP in `public/images/dishes/<slug>.webp`
and set `photo: "/images/dishes/<slug>.webp"` on the item. The homepage hero, the "From the
kitchen" gallery, the dish cards and the biryani picker all read from the same field.
The unreferenced `mutton-boti-gravy.webp` is a spare shot used in the homepage gallery.

## Project structure

```
src/app/            pages — home, menu, biryani, catering, about, contact,
                    login, checkout, orders (customer tracking), admin
src/components/     Nav, MobileNav, Footer, CartDrawer, DishCard, BiryaniPicker,
                    QtyStepper, OrderStatusSteps, PhoneOtpForm, icons
src/lib/            firebase init, auth+cart contexts, db (orders/counter/admin),
                    menu.ts (pricing), order-dates.ts, whatsapp.ts, config.ts
firestore.rules     read/write rules (orders own vs admin, counter increment)
```

## Security model

- Firestore rules only let a customer **read/create their own** orders and **never change
  their own status** — only admins move status (see `firestore.rules`).
- The order counter only allows increments of exactly `+1` per request.
- Admins are the Firestore allowlist `/admins/{phone}`; no admin flag lives on the client.
- OTP-sign-in is replaced by **email link (passwordless) sign-in** — no passwords to
  leak, no SMS quota. If the link email stops arriving, check the provider is still
  enabled under **Authentication → Sign-in method → Email/Password**.