/**
 * Admin utility script to safely view and delete test orders in Firestore.
 *
 * Usage:
 *   # 1. Dry run (default): list orders without deleting anything:
 *   node --env-file=.env.local scripts/delete-test-orders.mjs
 *
 *   # 2. Delete all orders:
 *   node --env-file=.env.local scripts/delete-test-orders.mjs --apply
 *
 *   # 3. Delete all orders AND reset the order counter (so next order starts at RK-00001):
 *   node --env-file=.env.local scripts/delete-test-orders.mjs --apply --reset-counter
 *
 *   # 4. Full cleanup (delete orders, reset counter, reset menu quantities, clear payment intents):
 *   node --env-file=.env.local scripts/delete-test-orders.mjs --apply --reset-counter --reset-inventory --clean-intents
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY in .env.local.\n" +
    "Run with: node --env-file=.env.local scripts/delete-test-orders.mjs",
  );
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

const apply = process.argv.includes("--apply");
const resetCounter = process.argv.includes("--reset-counter");
const resetInventory = process.argv.includes("--reset-inventory");
const cleanIntents = process.argv.includes("--clean-intents");

console.log("=== Raku's Kitchen - Test Order Cleanup Utility ===");
console.log(`Mode: ${apply ? "🔴 LIVE WRITE (--apply)" : "🟡 DRY RUN (no changes will be made)"}\n`);

// 1. Fetch all orders
const ordersSnap = await db.collection("orders").get();

if (ordersSnap.empty) {
  console.log("No orders found in 'orders' collection.");
} else {
  console.log(`Found ${ordersSnap.size} order(s) in 'orders':`);
  for (const doc of ordersSnap.docs) {
    const d = doc.data();
    const dateStr = d.createdAt
      ? new Date(typeof d.createdAt === "number" ? d.createdAt : d.createdAt.toMillis?.() || Date.now()).toLocaleString()
      : "Unknown date";
    console.log(`  • ID: ${d.orderId ?? doc.id} (Doc ID: ${doc.id})`);
    console.log(`    Customer: ${d.customerName ?? "N/A"} | Phone: ${d.phone ?? "N/A"} | Total: ₹${d.grandTotal ?? 0}`);
    console.log(`    Status: ${d.status ?? "N/A"} | Created: ${dateStr}`);
    console.log(`    Items: ${(d.items || []).map((i) => `${i.name} (x${i.qty})`).join(", ") || "None"}\n`);
  }
}

// 2. Check meta/counters
const counterRef = db.doc("meta/counters");
const counterSnap = await counterRef.get();
const currentCounter = counterSnap.exists ? counterSnap.data()?.nextOrder : "Not set";
console.log(`Order counter (meta/counters): current nextOrder = ${currentCounter}`);

// 3. Check paymentIntents
const intentsSnap = await db.collection("paymentIntents").get();
console.log(`Payment intents (paymentIntents): ${intentsSnap.size} document(s) found.`);

// 4. Check menuConfig
const menuConfigSnap = await db.collection("menuConfig").get();
const activeOrderedItems = menuConfigSnap.docs
  .filter((d) => (d.data().orderedQty || 0) > 0)
  .map((d) => `${d.id}: ${d.data().orderedQty}`);
console.log(`Menu items with orderedQty > 0: ${activeOrderedItems.length > 0 ? activeOrderedItems.join(", ") : "None"}\n`);

if (!apply) {
  console.log("--------------------------------------------------------------------------------");
  console.log("ℹ️  Dry run finished. NO data was deleted.");
  console.log("To delete the orders and clean up, run with desired options:");
  console.log("  node --env-file=.env.local scripts/delete-test-orders.mjs --apply");
  console.log("  node --env-file=.env.local scripts/delete-test-orders.mjs --apply --reset-counter");
  console.log("  node --env-file=.env.local scripts/delete-test-orders.mjs --apply --reset-counter --reset-inventory --clean-intents");
  console.log("--------------------------------------------------------------------------------");
  process.exit(0);
}

// Execution Phase
console.log("Proceeding with deletions...\n");

// Delete orders in batches
if (!ordersSnap.empty) {
  const batch = db.batch();
  for (const doc of ordersSnap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  console.log(`✅ Deleted ${ordersSnap.size} order(s) from 'orders'.`);
}

// Reset counter if requested
if (resetCounter) {
  await counterRef.set({ nextOrder: 0 }, { merge: true });
  console.log("✅ Reset 'meta/counters' nextOrder to 0 (next order will be RK-00001).");
}

// Clean payment intents if requested
if (cleanIntents && !intentsSnap.empty) {
  const batch = db.batch();
  for (const doc of intentsSnap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  console.log(`✅ Deleted ${intentsSnap.size} document(s) from 'paymentIntents'.`);
}

// Reset menu orderedQty if requested
if (resetInventory && !menuConfigSnap.empty) {
  const batch = db.batch();
  for (const doc of menuConfigSnap.docs) {
    batch.update(doc.ref, { orderedQty: 0, updatedAt: Date.now() });
  }
  await batch.commit();
  console.log(`✅ Reset orderedQty to 0 for all items in 'menuConfig'.`);
}

console.log("\n🎉 Cleanup completed successfully!");
