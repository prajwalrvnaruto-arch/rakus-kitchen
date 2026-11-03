# Raku's Kitchen — Firebase Migration & Client Account Setup Guide

This guide details the exact step-by-step procedure to migrate the Firebase backend from the current developer/personal Gmail account to the client's official Raku's Kitchen Google account (as outlined in Phase 1.3 of [delivery_plan.md](../delivery_plan.md)).

---

## Migration Overview

| Step | Action | Performed In / By |
| :--- | :--- | :--- |
| **1** | Google Account Verification | Client's Google Account |
| **2** | Create Firebase Project (`rakus-kitchen-prod`) | Firebase Console |
| **3** | Enable Blaze Plan & Set ₹100 Budget Alert | Google Cloud Console / Billing |
| **4** | Setup Cloud Firestore (`asia-south1`) & Deploy Rules | Firestore Database |
| **5** | Enable Authentication & Authorized Domains | Firebase Auth |
| **6** | Seed Admin User & Role in Firestore | Firebase Auth + Firestore Data |
| **7** | Generate Service Account Key (`firebase-admin`) | Project Settings → Service Accounts |
| **8** | Register Web App & Collect Client Config (6 keys) | Project Settings → Your Apps |
| **9** | Invite Developer Account as Project Editor | Project Settings → Users & Permissions |
| **10**| Update Environment Variables & Secrets | `.env.local` & Firebase App Hosting |
| **11**| Verification & End-to-End Test | Local Dev / Live Staging |

---

## Step 1: Sign in with Raku's Kitchen Gmail Account

1. Open a fresh browser profile or incognito window.
2. Sign in to [Firebase Console](https://console.firebase.google.com) using Raku's Kitchen official Google account (e.g., `rakuskitchen.tech@gmail.com`).

---

## Step 2: Create the Firebase Project

1. Click **Add project** (or **Create a project**).
2. Enter project name: `rakus-kitchen` (or `rakus-kitchen-prod`).
3. Google Analytics: Optional (disable or enable as preferred).
4. Click **Create project** and wait for provisioning.

---

## Step 3: Upgrade to Blaze Plan & Set Budget Alert

Firebase App Hosting, Cloud Run, and backend API routes require outbound network access and production quotas.

1. In Firebase Console (bottom-left), click **Upgrade** → select **Blaze (Pay-as-you-go)**.
2. Link the client's business debit/credit card.
3. **Set ₹100/month Budget Alert (Mandatory Safety Net):**
   - Go to [Google Cloud Console Billing](https://console.cloud.google.com/billing).
   - Select the billing account → **Budgets & alerts** → **Create budget**.
   - Target project: Raku's Kitchen project.
   - Amount: Target **₹100 INR**.
   - Notifications: Set email alerts at 50%, 90%, and 100%.

---

## Step 4: Create Cloud Firestore & Deploy Security Rules

1. In Firebase Console sidebar, navigate to **Databases and storage → Firestore Database**.
2. Click **Create database**.
3. Select **Production mode** (Security Rules will be deployed next).
4. **Location:** Select **`asia-south1` (Mumbai)**.
   > **Note:** Mumbai provides the lowest latency (~20–40ms) for Bengaluru customers.
5. Click **Enable**.
6. Once provisioned, open the **Rules** tab.
7. Replace all text with the content from [firestore.rules](../../firestore.rules) in this repository and click **Publish**.
8. (Optional) Check [firestore.indexes.json](../../firestore.indexes.json) if custom indexes are defined.

---

## Step 5: Configure Firebase Authentication

1. In Firebase Console sidebar, navigate to **Security → Authentication**.
2. Click **Get started**.
3. Under **Sign-in method**:
   - Click **Email/Password** → toggle **Enable** → click **Save**.
     *(Used by kitchen manager/admin to log into `/admin`).*
   - *(Note: Phone login for customers runs via Fast2SMS server-side integration in `src/lib/server/phoneAuth.ts` and mints custom auth tokens).*
4. Under **Settings → Authorized domains**:
   - Ensure `localhost` is listed.
   - Click **Add domain** and add your production domain(s):
     - e.g. `rakuskitchen.in`
     - e.g. `<project-id>.web.app` / Firebase App Hosting domain.

---

## Step 6: Create Admin User in Auth & Allowlist in Firestore

1. In **Authentication → Users** tab, click **Add user**:
   - Email: Raku's Kitchen admin email (e.g. `admin@rakuskitchen.in` or the Gmail address).
   - Password: Set a strong initial password.
2. Click **Add user**.
3. Look at the created row and copy the **User UID** (alphanumeric string like `5bdmfFawjOTWKq7i...`).
4. Go to **Firestore Database → Data** tab:
   - Click **Start collection**.
   - Collection ID: `admins`
   - Document ID: Paste the **User UID** copied in step 3.
   - Add field:
     - Field name: `role`
     - Type: `string`
     - Value: `admin`
   - Click **Save**.

---

## Step 7: Generate Service Account Key (`firebase-admin`)

Server-side operations (creating orders, checking stock in `menuConfig`, generating customer tokens, admin validation) require Firebase Admin credentials.

1. Click the gear icon ⚙️ next to Project Overview → **Project settings**.
2. Open the **Service accounts** tab.
3. Ensure **Firebase Admin SDK** is selected.
4. Click **Generate new private key** → confirm **Generate key**.
5. A `.json` file downloads. Open it and note the following three fields:
   - `project_id`
   - `client_email`
   - `private_key` (keep the `-----BEGIN PRIVATE KEY-----\n...` format).

> ⚠️ **SECURITY WARNING:** Never commit this JSON file or push it to GitHub. It is already added to `.gitignore`.

---

## Step 8: Register Web App (Client SDK Config)

1. In **Project settings → General** tab, scroll down to **Your apps**.
2. Click the **Web `</>`** icon.
3. App nickname: `raku-web` (leave Firebase Hosting checkbox unchecked for now).
4. Click **Register app**.
5. Copy the 6 configuration keys from the `firebaseConfig` object:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

---

## Step 9: Invite Developer Google Account as Editor

To allow ongoing development, CI/CD, and monitoring without needing the client's master password:

1. In **Project settings → Users and permissions** tab.
2. Click **Add member**.
3. Enter your developer Google Account email.
4. Role: Select **Editor** (or **Firebase Admin**).
5. Click **Done** / **Add Member**.
6. Accept the invitation email received on your developer account.

---

## Step 10: Update Environment Variables

### Local Development (`.env.local`)
Replace the Firebase keys in `.env.local` with the new project values:

```bash
# Frontend Web App Config (From Step 8)
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="rakus-kitchen-prod.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="rakus-kitchen-prod"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="rakus-kitchen-prod.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1234567890"
NEXT_PUBLIC_FIREBASE_APP_ID="1:1234567890:web:abcdef"

# Server Admin SDK Config (From Step 7)
FIREBASE_ADMIN_PROJECT_ID="rakus-kitchen-prod"
FIREBASE_ADMIN_CLIENT_EMAIL="firebase-adminsdk-xxxxx@rakus-kitchen-prod.iam.gserviceaccount.com"
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Production (Firebase App Hosting)
Configure these same variables in the Firebase App Hosting dashboard under **Environment Variables / Secrets**.

---

## Step 11: Verification Checklist

Run local testing to verify connectivity to the new Firebase project:

1. **Start dev server:**
   ```bash
   npm run dev
   ```
2. **Verify Frontend Config:**
   - Open `http://localhost:3000/login`.
   - Ensure the login form displays normally without any "Firebase isn't configured yet" warning.
3. **Verify Admin Login:**
   - Open `http://localhost:3000/admin`.
   - Log in with the admin email and password created in Step 6.
   - Confirm the Admin Dashboard loads and you are not blocked by the AdminGate.
4. **Verify Firestore Writes:**
   - In Firestore Console, check that audit logs or menu configuration records are created when orders or admin settings change.
