// Tests the webhook amount-mismatch path on an order Cashfree reports as PAID.
// Uses the DEV Firebase project from .env.local. Run:
//   node --env-file=.env.local e2e/webhook-mismatch-test.mjs
import { chromium } from "playwright";
import admin from "firebase-admin";
import crypto from "node:crypto";
import { Cashfree, CFEnvironment } from "cashfree-pg";

const BASE = "http://localhost:3000";
if (process.env.FIREBASE_ADMIN_PROJECT_ID !== "rakus-kitchen") throw new Error("Refusing to run: not the dev project");
if (process.env.CASHFREE_ENV === "production") throw new Error("Refusing to run against Cashfree production");

admin.initializeApp({ credential: admin.credential.cert({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
}) });
const db = admin.firestore();
const cf = new Cashfree(CFEnvironment.SANDBOX, process.env.CASHFREE_APP_ID, process.env.CASHFREE_SECRET_KEY);

const results = [];
const rec = (id, name, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${d ? "  → " + d : ""}`); };
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const api = async (path, { token, body, headers = {}, raw } = {}) => {
  const h = { ...headers }; if (token) h.authorization = `Bearer ${token}`; if (body !== undefined) h["content-type"] = "application/json";
  const r = await fetch(BASE + path, { method: "POST", headers: h, body: raw ?? JSON.stringify(body) });
  const text = await r.text(); let data = {}; try { data = JSON.parse(text); } catch {}
  return { status: r.status, data, text: text.slice(0, 180) };
};
const sign = (ts, raw) => crypto.createHmac("sha256", process.env.CASHFREE_SECRET_KEY).update(ts + raw).digest("base64");
const webhook = (orderId, cfPaymentId, amount) => {
  const raw = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: {
    order: { order_id: orderId, order_amount: amount, order_currency: "INR" },
    payment: { cf_payment_id: cfPaymentId, payment_status: "SUCCESS", payment_amount: amount, payment_currency: "INR" } } });
  const ts = String(Date.now());
  return api("/api/payments/webhook", { raw, headers: { "content-type": "application/json", "x-webhook-timestamp": ts, "x-webhook-signature": sign(ts, raw) } });
};

const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = browser.contexts()[0].pages().find((p) => p.url().startsWith(BASE));
const T = await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("firebaseLocalStorageDb");
  r.onsuccess = () => { const g = r.result.transaction("firebaseLocalStorage").objectStore("firebaseLocalStorage").getAll();
    g.onsuccess = () => res(g.result.find((x) => x.value?.stsTokenManager)?.value.stsTokenManager.accessToken); };
}));
if (!T) throw new Error("No Firebase session in the browser tab");

const mealDate = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
const orderBody = { customerName: "QA Mismatch", phone: "+91 7411626375", fulfillmentType: "pickup", deliveryAddress: "",
  mealSlot: "Lunch", mealDate, items: [{ menuId: "andhra-chilli-chicken", name: "Chilly Chicken", variant: "½ kg", qty: 1 }] };

/** Creates an intent and pays it in the Cashfree sandbox, WITHOUT calling /verify. */
async function createPaidOrder(label) {
  const c = await api("/api/payments/create-order", { token: T, body: orderBody });
  if (!c.data.cashfreeOrderId) throw new Error(`${label}: create-order failed ${c.status} ${c.text}`);
  const pay = await fetch("https://sandbox.cashfree.com/pg/orders/sessions", { method: "POST",
    headers: { "content-type": "application/json", "x-api-version": "2023-08-01" },
    body: JSON.stringify({ payment_session_id: c.data.paymentSessionId, payment_method: { upi: { channel: "collect", upi_id: "testsuccess@gocash" } } }) });
  const payJson = await pay.json();
  let status = "";
  for (let i = 0; i < 20 && status !== "PAID"; i++) {
    status = (await cf.PGFetchOrder(c.data.cashfreeOrderId)).data.order_status;
    if (status !== "PAID") await wait(3);
  }
  return { id: c.data.cashfreeOrderId, amount: c.data.amount, cfPaymentId: String(payJson.cf_payment_id), status };
}

// ── Case A: Cashfree says PAID, but our intent expects a different amount ──
console.log("\n== Case A: paid order, intent amount does not match ==");
const A = await createPaidOrder("A");
rec("A0", "Cashfree reports the order PAID", A.status === "PAID", `${A.id} ₹${A.amount} status=${A.status}`);
const intentA = db.collection("paymentIntents").doc(A.id);
await intentA.update({ amount: A.amount + 100 }); // simulate a tampered / mismatched intent
const wA = await webhook(A.id, A.cfPaymentId, A.amount);
rec("A1", "signed fresh webhook is not a 500 (no retry storm)", wA.status === 200, `${wA.status} ${wA.text}`);
rec("A2", "response reports amount_mismatch", wA.data.error === "amount_mismatch", wA.text);
const snapA = (await intentA.get()).data();
rec("A3", "intent marked failed with the reason", snapA.status === "failed" && /amount_mismatch/.test(snapA.failureReason || ""), `${snapA.status} / ${snapA.failureReason}`);
rec("A4", "no order was created", !snapA.orderId);
const ordersA = await db.collection("orders").where("payment.cashfreeOrderId", "==", A.id).get();
rec("A5", "no orders document references this payment", ordersA.empty, `${ordersA.size} found`);
const wA2 = await webhook(A.id, A.cfPaymentId, A.amount);
rec("A6", "Cashfree retry of the same event is deduped", wA2.status === 200 && wA2.data.deduped === true, wA2.text);
const vA = await api("/api/payments/verify", { token: T, body: { cashfreeOrderId: A.id } });
rec("A7", "customer verify does not create an order either", !vA.data.order, `${vA.status} ${vA.text}`);

// ── Case B: Cashfree says PAID, webhook payload lies about the amount ──
console.log("\n== Case B: paid order, webhook payload amount is wrong ==");
const B = await createPaidOrder("B");
rec("B0", "Cashfree reports the order PAID", B.status === "PAID", `${B.id} ₹${B.amount} status=${B.status}`);
const wB = await webhook(B.id, B.cfPaymentId, 1); // payload claims ₹1
rec("B1", "webhook accepted (uses Cashfree's amount, not the payload's)", wB.status === 200 && wB.data.ok === true, `${wB.status} ${wB.text}`);
const snapB = (await db.collection("paymentIntents").doc(B.id).get()).data();
rec("B2", "intent is paid and linked to an order", snapB.status === "paid" && !!snapB.orderId, `${snapB.status} order=${snapB.orderId}`);
const orderB = snapB.orderId ? (await db.collection("orders").doc(snapB.orderId).get()).data() : null;
rec("B3", "order stores the real amount, not ₹1", orderB?.payment?.amount === B.amount, `stored ₹${orderB?.payment?.amount}`);
const vB = await api("/api/payments/verify", { token: T, body: { cashfreeOrderId: B.id } });
rec("B4", "customer verify returns that same order (no duplicate)", vB.data.order?.id === snapB.orderId, vB.data.order?.orderId);

console.log(`\n==== ${results.filter(Boolean).length}/${results.length} passed ====`);
console.log(`Test data: intents ${A.id} (failed), ${B.id} → order ${orderB?.orderId ?? "-"}`);
process.exit(0);
