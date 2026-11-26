/**
 * Daily payment reconciliation — READ ONLY, changes nothing.
 *
 * Finds customers who paid but got no order: every payment intent created in
 * the window is checked against Cashfree's own order status. Anything Cashfree
 * reports as PAID that isn't a "paid" intent linked to an existing order is
 * flagged for manual follow-up (create the order by hand, or refund).
 *
 * Usage:
 *   node --env-file=.env.local scripts/reconcile-payments.mjs            # last 26 hours
 *   node --env-file=.env.local scripts/reconcile-payments.mjs --hours 72
 *
 * Exit code: 0 = all clear, 2 = problems found, 1 = script error.
 * The non-zero exit on problems lets a scheduler (cron / Cloud Scheduler) alert.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Cashfree, CFEnvironment } from "cashfree-pg";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const appId = process.env.CASHFREE_APP_ID;
const secretKey = process.env.CASHFREE_SECRET_KEY;

if (!projectId || !clientEmail || !privateKey || !appId || !secretKey) {
  console.error(
    "Missing Firebase admin or Cashfree credentials.\n" +
    "Run with: node --env-file=.env.local scripts/reconcile-payments.mjs",
  );
  process.exit(1);
}

const hoursArg = process.argv.indexOf("--hours");
const hours = hoursArg > -1 ? Number(process.argv[hoursArg + 1]) : 26;
if (!Number.isFinite(hours) || hours <= 0) {
  console.error("--hours must be a positive number");
  process.exit(1);
}

if (getApps().length === 0) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();
const mode = process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
const cf = new Cashfree(
  mode === "production" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
  appId,
  secretKey,
);

const since = Date.now() - hours * 3600_000;
console.log(`=== Payment reconciliation: project ${projectId}, Cashfree ${mode}, last ${hours}h ===\n`);

const snap = await db.collection("paymentIntents").where("createdAt", ">=", since).get();
const problems = [];
const counts = { checked: 0, paidOk: 0, unpaid: 0, lookupFailed: 0 };

for (const doc of snap.docs) {
  const intent = doc.data();
  counts.checked++;

  let cfStatus, cfAmount;
  try {
    const res = await cf.PGFetchOrder(doc.id);
    cfStatus = res.data?.order_status;
    cfAmount = res.data?.order_amount;
  } catch (err) {
    counts.lookupFailed++;
    problems.push({ id: doc.id, issue: "Cashfree lookup failed", detail: err.response?.data?.message ?? err.message, intent });
    continue;
  }

  if (cfStatus !== "PAID") {
    counts.unpaid++;
    // A paid intent for an order Cashfree says isn't paid should never happen.
    if (intent.status === "paid") {
      problems.push({ id: doc.id, issue: `Intent is paid but Cashfree says ${cfStatus}`, intent });
    }
    continue;
  }

  // Cashfree has the customer's money. There must be a real order for it.
  if (intent.status !== "paid" || !intent.orderId) {
    problems.push({
      id: doc.id,
      issue: "PAID at Cashfree, no order created",
      detail: `intent status=${intent.status}${intent.failureReason ? ` (${intent.failureReason})` : ""}, charged ₹${cfAmount}`,
      intent,
    });
    continue;
  }
  const order = await db.collection("orders").doc(intent.orderId).get();
  if (!order.exists) {
    problems.push({ id: doc.id, issue: "Intent links to a missing order", detail: `orderId=${intent.orderId}`, intent });
    continue;
  }
  if (Math.abs((order.data().payment?.amount ?? 0) - cfAmount) > 1) {
    problems.push({
      id: doc.id,
      issue: "Order amount differs from Cashfree",
      detail: `order ${order.data().orderId} ₹${order.data().payment?.amount} vs Cashfree ₹${cfAmount}`,
      intent,
    });
    continue;
  }
  counts.paidOk++;
}

console.log(
  `Checked ${counts.checked} intents: ${counts.paidOk} paid with an order, ` +
  `${counts.unpaid} not paid, ${counts.lookupFailed} lookup failures.\n`,
);

if (problems.length === 0) {
  console.log("✅ All clear: every Cashfree payment has a matching order.");
  process.exit(0);
}

console.log(`⚠️  ${problems.length} need attention:\n`);
for (const p of problems) {
  const d = p.intent.draft ?? {};
  console.log(`• ${p.id}: ${p.issue}`);
  if (p.detail) console.log(`    ${p.detail}`);
  console.log(`    customer ${d.customerName ?? "?"} ${d.phone ?? ""} · ${d.mealSlot ?? ""} ${d.mealDate ?? ""} · intent ₹${p.intent.amount}`);
}
process.exit(2);
