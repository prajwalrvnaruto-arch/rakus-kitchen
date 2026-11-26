#!/usr/bin/env tsx
/**
 * Bootstrap production accounts for rakus-kitchen-prod Firebase project.
 * Creates admin and kitchen staff users with email/password auth.
 *
 * Run with: npx tsx scripts/bootstrap-prod-accounts.ts
 *
 * Requirements:
 * - Application Default Credentials set to rakus-kitchen-prod
 *   (run: gcloud auth application-default login)
 * - FIREBASE_ADMIN_* env vars pointing to rakus-kitchen-prod
 */

import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";

const ADMIN_EMAIL = "rakuskitchen369@gmail.com";
const ADMIN_PASSWORD = "Q#erty7890";
const KITCHEN_EMAIL = "kitchen@rakuskitchen.com";
const KITCHEN_PASSWORD = generateStrongPassword();

function generateStrongPassword(): string {
  // 20 chars: letters, numbers, symbols
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  return Array.from(randomBytes(20))
    .map(b => chars[b % chars.length])
    .join("");
}

async function main() {
  console.log("🔧 Bootstrapping production accounts for rakus-kitchen-prod\n");

  // Initialize Firebase Admin with ADC (uses application_default_credentials.json)
  let app: App;
  if (!getApps().length) {
    app = initializeApp({
      projectId: "rakus-kitchen-prod",
    });
  } else {
    app = getApps()[0];
  }

  const auth = getAuth(app);
  const db = getFirestore(app);

  // 1. Create admin user
  console.log(`📧 Creating admin user: ${ADMIN_EMAIL}`);
  let adminUid: string;
  try {
    const adminUser = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      emailVerified: true,
      displayName: "Admin",
    });
    adminUid = adminUser.uid;
    console.log(`✅ Admin user created: ${adminUid}`);
  } catch (err: any) {
    if (err.code === "auth/email-already-exists") {
      const existingUser = await auth.getUserByEmail(ADMIN_EMAIL);
      adminUid = existingUser.uid;
      console.log(`⚠️  Admin user already exists: ${adminUid}`);
    } else {
      throw err;
    }
  }

  // 2. Create /admins/{uid} Firestore doc
  console.log(`📝 Creating /admins/${adminUid} Firestore doc`);
  await db.doc(`admins/${adminUid}`).set(
    {
      email: ADMIN_EMAIL,
      createdAt: new Date().toISOString(),
      createdBy: "bootstrap-script",
    },
    { merge: true }
  );
  console.log(`✅ Admin doc created\n`);

  // 3. Create kitchen staff user
  console.log(`📧 Creating kitchen staff user: ${KITCHEN_EMAIL}`);
  let kitchenUid: string;
  try {
    const kitchenUser = await auth.createUser({
      email: KITCHEN_EMAIL,
      password: KITCHEN_PASSWORD,
      emailVerified: true,
      displayName: "Kitchen Staff",
    });
    kitchenUid = kitchenUser.uid;
    console.log(`✅ Kitchen staff user created: ${kitchenUid}`);
  } catch (err: any) {
    if (err.code === "auth/email-already-exists") {
      const existingUser = await auth.getUserByEmail(KITCHEN_EMAIL);
      kitchenUid = existingUser.uid;
      console.log(`⚠️  Kitchen staff user already exists: ${kitchenUid}`);
      console.log(`⚠️  Password was NOT updated (Firebase Admin SDK requires deleteUser + recreate to change password)`);
    } else {
      throw err;
    }
  }

  // 4. Create /kitchenStaff/{uid} Firestore doc
  console.log(`📝 Creating /kitchenStaff/${kitchenUid} Firestore doc`);
  await db.doc(`kitchenStaff/${kitchenUid}`).set(
    {
      email: KITCHEN_EMAIL,
      createdAt: new Date().toISOString(),
      createdBy: "bootstrap-script",
    },
    { merge: true }
  );
  console.log(`✅ Kitchen staff doc created\n`);

  // Summary
  console.log("🎉 Production accounts bootstrapped!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 CREDENTIALS (save these securely):\n");
  console.log(`Admin account:`);
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  UID:      ${adminUid}`);
  console.log(`  Login:    https://rakuskitchen.com/admin/login\n`);
  console.log(`Kitchen staff account:`);
  console.log(`  Email:    ${KITCHEN_EMAIL}`);
  console.log(`  Password: ${KITCHEN_PASSWORD}`);
  console.log(`  UID:      ${kitchenUid}`);
  console.log(`  Login:    https://rakuskitchen.com/kitchen/login`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
