# Raku's Kitchen — Firebase setup (email login)

This walks you from zero to a working **email magic-link login** (Firebase's "email
link / passwordless" sign-in — Firebase doesn't do email OTP codes; the magic link is
its native equivalent, with no SMS and no reCAPTCHA). Every step maps to something the
app actually checks — the code anchors are noted so you know *why* each step exists.

> **Bottom line:** you need the **6 values in step 2** pasted into **`.env.local`** (step 8),
> then step 7 makes **you** the admin. Everything else is what makes those three work.
> The whole thing takes ~15 minutes.

---

## 1. Create a Firebase project

`console.firebase.google.com` → **Add project** → name it (e.g. `rakus-kitchen`) →
Google Analytics optional → **Create**. Wait for the "Your project is ready" banner.

## 2. Register a web app → get the `firebaseConfig` block ★ 6 values live here ★

**Project settings ⚙️ → Your apps → Web `</>`** → give it a nickname (e.g.
`raku-web`) → **Register app** → you'll see a `firebaseConfig` object like:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "rakus-kitchen.firebaseapp.com",
  projectId: "rakus-kitchen",
  storageBucket: "rakus-kitchen.appspot.com",
  messagingSenderId: "12...",
  appId: "1:12...:web:..."
};
```

**Copy these six values** — you'll paste them into `.env.local` in step 8. (You don't
need the `measurementId`.)

> The app (see `src/lib/firebase.ts:14`) only turns Firebase on when **all six** are
> non-empty. If any is blank, the login page shows *"Firebase isn't configured yet"*.

## 3. Enable email/password sign-in

> **New sidebar:** the console was redesigned — there is no "Build" menu anymore.
> Products are grouped under categories: **Security → Authentication**,
> **Databases and storage → Firestore Database**.

**Security → Authentication → Sign-in method → Email/Password → Enable** → **Save**.

> Skipping this → login fails with `auth/operation-not-allowed`.
> Phone sign-in is **not** used anymore — skip it entirely.

## 4. Create Firestore

**Databases and storage → Firestore Database → Create database** → **Production mode** →
choose a location (India → `asia-south1`) → **Enable**.

> Firestore holds orders, the RK-00001 counter, and the admin allowlist — all of it.

## 5. Publish the security rules

**Firestore → Rules** tab → delete the default → paste the entire contents of the
repo's **`firestore.rules`** → **Publish**.

> This is the whole security model: customers create/read only their own orders, the
> counter can only increment by 1, and `isAdmin()` checks the allowlist below.

## 6. Authorized domains (email-link landing page)

The login email links back to **`/login`** on your site. **Security → Authentication →
Settings → Authorized domains** → confirm `localhost` is listed (dev works out of the
box). Add your deployed domain (e.g. `your-app.vercel.app`) once you go live.

> Without the domain authorized, clicking the magic link in the email fails with
> `auth/invalid-action-code` (the app logs you out of the link round-trip — the form
> shows the tiny "enter the email you used" retry, which is the normal fallback
> whenever the link is opened on a different device/browser anyway).

## 7. Make yourself admin ★

**Firestore → Data** → **Start collection** named `admins` → document ID exactly
**your UID** (the Firebase Auth `uid`, not the email — a ~28-char alphanumeric string
like `5bdmfFawjOTWKq7i8kshgVRFrbe2`). Find it under
**Authentication → Users → your account → User UID**, or sign in on the app and check
the console (or the admin page's "Verify admin access" panel, which now prints your UID).
Add a field `role: "admin"` → **Save**.

> The route guard (`src/lib/auth-context.tsx:45`) does `setIsAdmin(snap.exists())` — the
> document just needs to **exist**. Without it, `/admin` shows *"Admins only"* even when
> you're logged in.
>
> **Why UID and not email?** Firestore rules interpolation of the email claim inside
> `exists()/get()` path references fails with `||invalid_argument||`, so an email-keyed
> allowlist can never pass. The UID (`request.auth.uid`) interpolates reliably — the
> rules use `admins/{uid}` instead of `admins/{email}`.

## 8. Fill `.env.local`

Your repo now has a `.env.local` (already copied from `.env.local.example`). Open it and
map the values from step 2:

| Firebase config key   | `.env.local` variable                    |
|-----------------------|------------------------------------------|
| `apiKey`              | `NEXT_PUBLIC_FIREBASE_API_KEY=`           |
| `authDomain`          | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=`       |
| `projectId`           | `NEXT_PUBLIC_FIREBASE_PROJECT_ID=`        |
| `storageBucket`       | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=`    |
| `messagingSenderId`   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=` |
| `appId`               | `NEXT_PUBLIC_FIREBASE_APP_ID=`            |

Leave `NEXT_PUBLIC_EMULATOR=false` for real SMS. If you later use the emulators for
offline testing, flip it to `true` (step 9), then back to `false`.

## 9. (Optional) Test offline with emulators

Needs **Java** installed. Two terminals:

```bash
# terminal 1
npm run emulators                         # auth :9099 · firestore :8080 · UI :4000

# terminal 2
NEXT_PUBLIC_EMULATOR=true npm run dev     # note: this environment needs NODE_ENV=development too
```

Then any 10-digit number works and the OTP is `000000` (shown in the emulator log).
`firebase.json` has this configured with a demo project id — nothing else to set up.
Switch `NEXT_PUBLIC_EMULATOR` back to `false` before real SMS.

## 10. Verify end-to-end

```bash
NODE_ENV=development npm run dev
```

1. Open **`/login`** → you see the real email entry (not the "isn't configured" card).
2. Enter your email → a one-tap login link arrives (check spam) → **click it**.
3. Your browser lands back on `/login`, shows *Completing sign-in…*, and you're redirected
   to **`/orders`**.
4. Open **`/admin`** → you no longer see "Admins only".

---

## If login fails

Make sure **Email/Password** is enabled in the Firebase console (step 3) — otherwise
login fails with `auth/operation-not-allowed`. For new users, pick "Create account" on
the login form to register before signing in. If you get `auth/invalid-credential`, the
email or password is wrong.

## Env var quick reference

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` (6) | From your web app `firebaseConfig` (step 2) |
| `NEXT_PUBLIC_EMULATOR` | `false` for real Firebase; `true` to hit local emulators |