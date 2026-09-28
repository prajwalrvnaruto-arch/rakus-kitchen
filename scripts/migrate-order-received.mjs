/**
 * One-time migration: bump any order still sitting at the retired
 * "Order Received" status to "Confirmed" (appending a statusHistory event).
 *
 * "Order Received" was removed from the OrderStatus type once payment
 * verification started creating orders directly as "Confirmed" — a paid
 * order is definitionally confirmed, so the extra manual step is gone.
 * This script is a one-shot cleanup for any pre-existing order docs left
 * at the old status. Safe to delete after it's been run successfully.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-order-received.mjs           # dry run (default)
 *   node --env-file=.env.local scripts/migrate-order-received.mjs --apply   # actually writes
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY.\n" +
    "Run with: node --env-file=.env.local scripts/migrate-order-received.mjs",
  );
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();
const apply = process.argv.includes("--apply");

const snap = await db.collection("orders").where("status", "==", "Order Received").get();

if (snap.empty) {
  console.log("No orders at 'Order Received'. Nothing to do.");
  process.exit(0);
}

console.log(`Found ${snap.size} order(s) at 'Order Received':`);
for (const doc of snap.docs) {
  const d = doc.data();
  console.log(`  - ${d.orderId ?? doc.id} (doc: ${doc.id}, customer: ${d.customerName ?? "?"})`);
}

if (!apply) {
  console.log("\nDry run only — no writes made. Re-run with --apply to migrate these orders.");
  process.exit(0);
}

const now = Date.now();
const batch = db.batch();
for (const doc of snap.docs) {
  const history = doc.data().statusHistory ?? [];
  batch.update(doc.ref, {
    status: "Confirmed",
    statusHistory: [...history, { status: "Confirmed", at: now }],
    updatedAt: now,
  });
}
await batch.commit();

console.log(`\nMigrated ${snap.size} order(s) to 'Confirmed'.`);
