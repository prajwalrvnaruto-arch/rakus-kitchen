const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
})});
(async () => {
  const db = getFirestore();
  const snap = await db.collection("orders").where("_test", "==", true).get();
  const all = snap.docs.map((d) => d.data());
  console.log(`Total test docs: ${all.length} (incl. ${all.filter((o) => o.status === "Cancelled").length} cancelled)`);
  const orders = all.filter((o) => o.status !== "Cancelled");
  for (const slot of ["Lunch", "Dinner"]) {
    const os = orders.filter((o) => o.mealSlot === slot);
    const agg = {};
    for (const o of os) for (const it of o.items) {
      const k = `${it.name}${it.variant ? " (" + it.variant + ")" : ""}`;
      agg[k] = (agg[k] || 0) + it.qty;
    }
    console.log(`\n${slot} — ${os.length} orders`);
    for (const [k, v] of Object.entries(agg)) console.log(`  ${v} × ${k}`);
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
