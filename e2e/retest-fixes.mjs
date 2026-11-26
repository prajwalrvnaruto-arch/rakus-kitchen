// Retest of the 8 fixed bugs + one full sandbox payment, in the logged-in mobile tab.
// Run: node --env-file=.env.local e2e/retest-fixes.mjs
import { chromium } from "playwright";
import crypto from "node:crypto";
const BASE = "http://localhost:3000";
const results = [];
const rec = (id, name, ok, d = "") => { results.push({ id, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${d ? "  → " + d : ""}`); };
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const api = async (path, { method = "POST", token, body, headers = {}, raw } = {}) => {
  const h = { ...headers }; if (token) h.authorization = `Bearer ${token}`; if (body !== undefined) h["content-type"] = "application/json";
  const r = await fetch(BASE + path, { method, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await r.text(); let data = {}; try { data = JSON.parse(text); } catch {}
  return { status: r.status, data, text: text.slice(0, 160) };
};

const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = browser.contexts()[0].pages().find((p) => p.url().startsWith(BASE));
const T = await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("firebaseLocalStorageDb");
  r.onsuccess = () => { const g = r.result.transaction("firebaseLocalStorage").objectStore("firebaseLocalStorage").getAll();
    g.onsuccess = () => res(g.result.find((x) => x.value?.stsTokenManager)?.value.stsTokenManager.accessToken); };
}));
if (!T) throw new Error("no session in browser");
const date = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
const base = { customerName: "QA", phone: "+91 7411626375", fulfillmentType: "pickup", deliveryAddress: "", mealSlot: "Lunch", mealDate: date,
  items: [{ menuId: "andhra-chilli-chicken", name: "Chilly Chicken", variant: "½ kg", qty: 1 }] };
const co = (b, tok = T) => api("/api/payments/create-order", { token: tok, body: b });
const key = process.env.CASHFREE_SECRET_KEY;
const sign = (ts, raw) => crypto.createHmac("sha256", key).update(ts + raw).digest("base64");
const evt = (id, pay, amt) => JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: id, order_amount: amt, order_currency: "INR" }, payment: { cf_payment_id: pay, payment_status: "SUCCESS", payment_amount: amt, payment_currency: "INR" } } });
const wh = (raw, ts) => api("/api/payments/webhook", { raw, headers: { "content-type": "application/json", "x-webhook-timestamp": ts, "x-webhook-signature": sign(ts, raw) } });

// Bug 4: invalid token → 401 (no rate-limit cost: auth fails first)
rec("B4a", "create-order with garbage token → 401", (await co(base, "abc.def.ghi")).status === 401);
rec("B4b", "verify with garbage token → 401", (await api("/api/payments/verify", { token: "abc.def.ghi", body: { cashfreeOrderId: "rk-x" } })).status === 401);
rec("B4c", "invoice with garbage token → 401", (await api("/api/orders/x/invoice", { method: "GET", token: "abc.def.ghi" })).status === 401);

// Bug 5: unknown / malformed order id
const v1 = await api("/api/payments/verify", { token: T, body: { cashfreeOrderId: "rk-fake-123" } });
rec("B5a", "verify unknown order id → 404 with plain message", v1.status === 404 && !/deducted/.test(v1.text), `${v1.status} ${v1.text}`);
const v2 = await api("/api/payments/verify", { token: T, body: { cashfreeOrderId: "../orders/abc" } });
rec("B5b", "verify path-like order id → 400", v2.status === 400, `${v2.status} ${v2.text}`);

// Bug 7: security headers
const h = Object.fromEntries((await fetch(BASE + "/checkout")).headers);
rec("B7", "security headers present", !!h["content-security-policy"] && h["x-frame-options"] === "SAMEORIGIN" && h["x-content-type-options"] === "nosniff");

// Bug 8: legal pages
const legal = [];
for (const p of ["/privacy", "/terms", "/refund-policy"]) if (/razorpay/i.test(await (await fetch(BASE + p)).text())) legal.push(p);
rec("B8", "legal pages no longer mention Razorpay", legal.length === 0, legal.join(","));

// Bug 1 + 6 (API) — 3 create-order calls, under the 5/min limit
const p1 = await co({ ...base, phone: "+91 12345" });
rec("B1a", "create-order with 5-digit phone → 400 invalid_phone", p1.status === 400 && p1.data.code === "invalid_phone", `${p1.status} ${p1.text}`);
const l1 = await co({ ...base, notes: "A".repeat(200000) });
rec("B6a", "200KB note → 400 field_too_long", l1.status === 400 && l1.data.code === "field_too_long", `${l1.status} ${l1.text}`);
const l2 = await co({ ...base, customerName: "N".repeat(81) });
rec("B6b", "81-char name → 400 field_too_long", l2.status === 400 && l2.data.code === "field_too_long", `${l2.status} ${l2.text}`);

// Bug 1 (UI): mobile checkout with a short number
await page.goto(BASE + "/menu", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.removeItem("rakus-kitchen-cart-v1"));
await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(2500);
const add = page.locator("button[aria-label^='Add ']").first(); await add.scrollIntoViewIfNeeded(); await add.click();
await page.waitForFunction(() => /quantity/.test(localStorage.getItem("rakus-kitchen-cart-v1") || ""), null, { timeout: 10000 });
await page.goto(BASE + "/checkout", { waitUntil: "domcontentloaded" }); await page.waitForSelector("#name", { timeout: 20000 });
await page.getByText("Self-Pickup").first().click();
await page.locator("#name").fill("QA Tester");
await page.locator("#dpdp-affirmative-consent").check();
await page.locator("#cphone").fill("12345");
const pay = page.locator("button[type=submit]").last();
await pay.click(); await page.waitForTimeout(1000);
const msg = await page.locator("[role=alert]").first().innerText().catch(() => "");
rec("B1b", "UI: 5-digit mobile shows a clear error, no payment started", /valid 10-digit/i.test(msg) && /\/checkout$/.test(page.url()), msg);
rec("B6c", "UI: name / notes inputs have length limits",
  (await page.locator("#name").getAttribute("maxlength")) === "80" && (await page.locator("#notes").getAttribute("maxlength")) === "500");

console.log("…waiting 65s for the order rate-limit window"); await wait(65);

// Bug 2 + 3: webhooks against an UNPAID intent
const unpaid = await co(base);
const uid = unpaid.data.cashfreeOrderId;
rec("pre", "fresh unpaid intent created", !!uid, `${unpaid.status} ${unpaid.text}`);
const old = String(Date.now() - 864e5);
const w1 = await wh(evt(uid, "880001", unpaid.data.amount), old);
rec("B2a", "signed webhook with 24h-old timestamp → 400", w1.status === 400, `${w1.status} ${w1.text}`);
const now = String(Date.now());
const w2 = await wh(evt(uid, "880002", unpaid.data.amount), now);
rec("B2b", "fresh signed SUCCESS webhook for an UNPAID order → 409, not trusted", w2.status === 409, `${w2.status} ${w2.text}`);
const w3 = await wh(evt(uid, "880003", 1), String(Date.now()));
rec("B3", "fresh signed webhook with wrong amount → not 500", w3.status !== 500, `${w3.status} ${w3.text}`);
const chk = await api("/api/payments/verify", { token: T, body: { cashfreeOrderId: uid } });
rec("B2c", "no order was created for the unpaid intent", !chk.data.order, `${chk.status} ${chk.text}`);

// Happy path: real UI checkout → Cashfree popup → sandbox UPI payment → confirm
await page.locator("#cphone").fill("7411626375");
let created = null;
const onResp = async (r) => { if (r.url().endsWith("/api/payments/create-order") && r.ok()) created = await r.json().catch(() => null); };
page.on("response", onResp);
await pay.click();
await page.waitForTimeout(7000);
page.off("response", onResp);
const frames = page.frames().map((f) => f.url()).filter((u) => /cashfree/.test(u));
rec("H1", "Cashfree opens as a popup over checkout", !!created?.paymentSessionId && /\/checkout$/.test(page.url()) && frames.length > 0, `frames=${frames.length}`);
const sp = await fetch("https://sandbox.cashfree.com/pg/orders/sessions", { method: "POST",
  headers: { "content-type": "application/json", "x-api-version": "2023-08-01" },
  body: JSON.stringify({ payment_session_id: created?.paymentSessionId, payment_method: { upi: { channel: "collect", upi_id: "testsuccess@gocash" } } }) });
console.log("sandbox pay:", sp.status);
let paidOrder = null;
for (let i = 0; i < 15 && !paidOrder; i++) {
  const v = await api("/api/payments/verify", { token: T, body: { cashfreeOrderId: created?.cashfreeOrderId } });
  paidOrder = v.data.order; if (!paidOrder) await wait(3);
}
await page.goto(`${BASE}/checkout/confirm?order_id=${created?.cashfreeOrderId}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
await page.screenshot({ path: "e2e/out/retest-confirm.png", fullPage: true });
rec("H2", "sandbox payment → confirm page shows success", /Payment successful/i.test(await page.innerText("body")), paidOrder?.orderId);
const w4 = await wh(evt(created?.cashfreeOrderId, "880004", paidOrder?.grandTotal), String(Date.now()));
const again = await api("/api/payments/verify", { token: T, body: { cashfreeOrderId: created?.cashfreeOrderId } });
rec("H3", "webhook for the PAID order accepted, still one order", w4.status === 200 && again.data.order?.id === paidOrder?.id, `${w4.status} ${again.data.order?.orderId}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} passed, ${failed.length} failed ====`);
process.exit(0);
