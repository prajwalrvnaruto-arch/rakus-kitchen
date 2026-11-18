// Read-only: counts real vs test orders per mealDate around today, so QA
// scenarios can pick a date with no real orders (exact-count assertions).
const { cert, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
}) });
(async () => {
  const db = getFirestore();
  const base = new Date(2026, 10, 15);
  for (let i = -3; i <= 4; i++) {
    const d = new Date(base); d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const s = await db.collection("orders").where("mealDate", "==", key).get();
    const real = s.docs.filter((x) => !x.data()._test).length;
    console.log(key, "real:", real, "test:", s.size - real);
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
