/**
 * One-time backfill: fix orders whose createdAt/updatedAt were corrupted by
 * a since-fixed bug in sanitizeFirestoreData() (see src/lib/sanitize.ts) — it
 * recursed into Firestore's FieldValue.serverTimestamp() sentinel like a
 * plain object and silently rebuilt it as `{}`, so every order created
 * before the fix has createdAt/updatedAt stored as an empty map instead of
 * a real Timestamp. mapOrder() then reads that back as epoch 0 (1 Jan
 * 1970), which is why "Today" / "Last 7 Days" / "This Month" analytics
 * filters always exclude these orders — only "All Time" has no date range
 * to fail.
 *
 * This finds every order whose createdAt (or updatedAt) isn't a real
 * Timestamp and backfills just that field from the first entry in
 * statusHistory (status: "Confirmed", at: Date.now() — a plain number,
 * untouched by the bug since it's written via the client SDK / plain JS,
 * never through sanitizeFirestoreData + a FieldValue sentinel), falling
 * back to payment.paidAt, then to now() as a last resort (logged loudly so
 * it's easy to spot). A field that already holds a real Timestamp (e.g.
 * updatedAt on an order that had a legitimate status change since creation)
 * is left alone.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-order-timestamps.mjs           # dry run (default)
 *   node --env-file=.env.local scripts/backfill-order-timestamps.mjs --apply   # actually writes
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY.\n" +
    "Run with: node --env-file=.env.local scripts/backfill-order-timestamps.mjs",
  );
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();
const apply = process.argv.includes("--apply");

const snap = await db.collection("orders").get();

if (snap.empty) {
  console.log("No orders found. Nothing to do.");
  process.exit(0);
}

function resolveFallbackEpochMs(d) {
  const history = Array.isArray(d.statusHistory) ? d.statusHistory : [];
  if (typeof history[0]?.at === "number") {
    return { epochMs: history[0].at, source: "statusHistory[0].at" };
  }
  if (typeof d.payment?.paidAt === "number") {
    return { epochMs: d.payment.paidAt, source: "payment.paidAt" };
  }
  return { epochMs: Date.now(), source: "now() — NO reliable source found, using current time" };
}

const plan = [];
for (const doc of snap.docs) {
  const d = doc.data();
  const createdAtBroken = !(d.createdAt instanceof Timestamp);
  const updatedAtBroken = !(d.updatedAt instanceof Timestamp);
  if (!createdAtBroken && !updatedAtBroken) continue;

  const { epochMs, source } = resolveFallbackEpochMs(d);
  const ts = Timestamp.fromMillis(epochMs);
  const updateData = {};
  if (createdAtBroken) updateData.createdAt = ts;
  if (updatedAtBroken) updateData.updatedAt = ts;

  plan.push({ doc, updateData, epochMs, source, createdAtBroken, updatedAtBroken });
}

if (plan.length === 0) {
  console.log(`Checked ${snap.size} order(s) — all already have real createdAt/updatedAt Timestamps. Nothing to do.`);
  process.exit(0);
}

console.log(`Found ${plan.length} of ${snap.size} order(s) needing a timestamp backfill:`);
for (const { doc, epochMs, source, createdAtBroken, updatedAtBroken } of plan) {
  const d = doc.data();
  const fields = [createdAtBroken && "createdAt", updatedAtBroken && "updatedAt"].filter(Boolean).join(" + ");
  console.log(
    `  - ${d.orderId ?? doc.id} (doc: ${doc.id}): ${fields} -> ${new Date(epochMs).toISOString()} (from ${source})`,
  );
}

if (!apply) {
  console.log("\nDry run only — no writes made. Re-run with --apply to backfill these orders.");
  process.exit(0);
}

const batch = db.batch();
for (const { doc, updateData } of plan) {
  batch.update(doc.ref, updateData);
}
await batch.commit();

console.log(`\nBackfilled ${plan.length} order(s).`);
