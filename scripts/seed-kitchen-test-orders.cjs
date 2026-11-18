// Dummy-order seeder for the /kitchen prep sheet — writes to LIVE Firestore.
//
// Every doc is tagged `_test: true` and `customerId: "TEST-KITCHEN-SEED"` so
// cleanup is unambiguous. Names are prefixed "TEST —" so they're obvious in
// the admin dashboard.
//
// Usage (loads creds from .env.local via Node's --env-file):
//   node --env-file=.env.local scripts/seed-kitchen-test-orders.cjs seed
//   node --env-file=.env.local scripts/seed-kitchen-test-orders.cjs seed --date=2026-11-15
//   node --env-file=.env.local scripts/seed-kitchen-test-orders.cjs clean
//
// `seed`  creates the dummy orders (default date = today, local time).
// `clean` deletes every order tagged `_test: true`.

const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const TEST_CUSTOMER_ID = "TEST-KITCHEN-SEED";
const TEST_TAG = "_test";

function initAdmin() {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing FIREBASE_ADMIN_* env vars — run with --env-file=.env.local");
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  console.log(`✓ Admin SDK connected to project "${projectId}"`);
}

// 5-char order id from the project's unambiguous charset.
const CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function orderId() {
  let c = "";
  for (let i = 0; i < 5; i++) c += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  return `RK-${c}`;
}

function line(menuId, name, qty, pricePerUnit, variant) {
  const l = { menuId, name, qty, pricePerUnit, lineTotal: qty * pricePerUnit };
  if (variant) l.variant = variant;
  return l;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Build a varied set of orders that exercises the prep-sheet aggregation:
// biryani weight-summing, weight-variant dishes (½/1 kg), extra-meat add-ons,
// both meal slots, a cancelled order (must be excluded), and overlapping items
// across orders (must be summed into one row).
function buildOrders(mealDate) {
  const PACK = 20;
  const defs = [
    // ── LUNCH ──
    {
      name: "TEST — Anita R", slot: "Lunch", status: "Confirmed",
      items: [
        line("biryani-chicken", "Chicken Biryani", 2, 320, "1 kg · Chicken"),
        line("extra-chicken-250g", "Extra Chicken 250g", 1, 150),
        line("andhra-chilli-chicken", "Chilly Chicken", 1, 400, "½ kg"),
      ],
    },
    {
      name: "TEST — Bhaskar M", slot: "Lunch", status: "Preparing",
      items: [
        line("biryani-chicken", "Chicken Biryani", 1, 160, "½ kg · Chicken"),
        line("biryani-mutton", "Mutton Biryani", 1, 420, "1 kg · Mutton"),
        line("ragi-mudde", "Ragi Mudde", 4, 20),
        line("rasam", "Rasam", 1, 200),
      ],
    },
    {
      name: "TEST — Chaitra S", slot: "Lunch", status: "Out for Delivery",
      items: [
        line("biryani-mutton", "Mutton Biryani", 2, 420, "1 kg · Mutton"),
        line("extra-mutton-250g", "Extra Mutton 250g", 2, 250),
        line("white-rice", "White Rice", 1, 300, "1 kg"),
      ],
    },
    // Cancelled — MUST NOT appear in the prep sheet.
    {
      name: "TEST — Cancelled (should be hidden)", slot: "Lunch", status: "Cancelled",
      items: [line("biryani-chicken", "Chicken Biryani", 9, 320, "1 kg · Chicken")],
    },

    // ── DINNER ──
    {
      name: "TEST — Deepak V", slot: "Dinner", status: "Confirmed",
      items: [
        line("biryani-chicken", "Chicken Biryani", 1, 320, "1 kg · Chicken"),
        line("guntur-chicken", "Guntur Chicken", 1, 800, "1 kg"),
        line("nati-koli-saru", "Nati Koli Saru", 1, 1500),
      ],
    },
    {
      name: "TEST — Esha K", slot: "Dinner", status: "Confirmed",
      items: [
        line("mutton-chops", "Mutton Chops", 1, 900, "½ kg"),
        line("pepper-mutton", "Mutton Pepper", 1, 1799, "1 kg"),
        line("fish-fry", "Fish Fry", 2, 800),
      ],
    },
    {
      name: "TEST — Farhan A (pickup)", slot: "Dinner", status: "Preparing", fulfillment: "pickup",
      items: [
        line("biryani-chicken", "Chicken Biryani", 3, 160, "½ kg · Chicken"),
        line("extra-chicken-250g", "Extra Chicken 250g", 2, 150),
        line("raita", "Raita", 2, 70),
      ],
    },
  ];

  return defs.map((d) => {
    const itemTotal = d.items.reduce((s, it) => s + it.lineTotal, 0);
    const grandTotal = itemTotal + PACK;
    const now = Date.now();
    const isPickup = d.fulfillment === "pickup";
    return {
      [TEST_TAG]: true,
      orderId: orderId(),
      customerId: TEST_CUSTOMER_ID,
      customerName: d.name,
      phone: "+910000000000",
      deliveryAddress: isPickup ? "" : "TEST address — 1 Dummy Rd, Bengaluru 560001",
      fulfillmentType: isPickup ? "pickup" : "delivery",
      mealSlot: d.slot,
      mealDate,
      items: d.items,
      itemTotal,
      packagingFee: PACK,
      grandTotal,
      status: d.status,
      statusHistory: [{ status: d.status, at: now, by: "test_seed" }],
      notes: "Seeded by scripts/seed-kitchen-test-orders.cjs",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
  });
}

async function seed(mealDate) {
  const db = getFirestore();
  const orders = buildOrders(mealDate);
  const batch = db.batch();
  for (const o of orders) batch.set(db.collection("orders").doc(), o);
  await batch.commit();
  const active = orders.filter((o) => o.status !== "Cancelled");
  const lunch = active.filter((o) => o.mealSlot === "Lunch").length;
  const dinner = active.filter((o) => o.mealSlot === "Dinner").length;
  console.log(`✓ Seeded ${orders.length} dummy orders for ${mealDate}`);
  console.log(`  → ${lunch} Lunch + ${dinner} Dinner active, 1 Cancelled (hidden)`);
  console.log(`  Open http://localhost:3000/kitchen and navigate to ${mealDate}.`);
}

async function clean() {
  const db = getFirestore();
  const snap = await db.collection("orders").where(TEST_TAG, "==", true).get();
  if (snap.empty) {
    console.log("✓ No test orders found — nothing to clean.");
    return;
  }
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`✓ Deleted ${snap.size} test orders.`);
}

(async () => {
  const cmd = process.argv[2];
  const dateArg = process.argv.find((a) => a.startsWith("--date="));
  const mealDate = dateArg ? dateArg.split("=")[1] : todayKey();

  if (!cmd || !["seed", "clean"].includes(cmd)) {
    console.error("Usage: node --env-file=.env.local scripts/seed-kitchen-test-orders.cjs <seed|clean> [--date=YYYY-MM-DD]");
    process.exit(1);
  }
  initAdmin();
  if (cmd === "seed") await seed(mealDate);
  else await clean();
  process.exit(0);
})().catch((e) => {
  console.error("✗ Failed:", e.message);
  process.exit(1);
});
