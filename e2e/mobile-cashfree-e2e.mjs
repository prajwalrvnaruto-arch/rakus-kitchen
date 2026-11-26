// Mobile E2E + security test for Raku's Kitchen (localhost:3000, Cashfree sandbox).
// Run: node --env-file=.env.local e2e/mobile-cashfree-e2e.mjs
import { chromium, devices } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const PHONE = "7411626375"; // whitelisted dev test account (OTP 123456 outside production)
const OTP = "123456";
const OUT = "e2e/out";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const bugs = [];
function rec(id, name, ok, detail = "") {
  results.push({ id, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? "  → " + detail : ""}`);
}
const j = (r) => r.json().catch(() => ({}));

async function api(path, { method = "POST", token, body, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (body !== undefined && !raw) h["content-type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, data, text };
}

async function login(phone = PHONE) {
  await api("/api/auth/send-otp", { body: { phone } });
  const v = await api("/api/auth/verify-otp", { body: { phone, otp: OTP } });
  if (!v.data.customToken) throw new Error("login failed: " + v.text);
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: v.data.customToken, returnSecureToken: true }) },
  );
  const d = await r.json();
  return { uid: v.data.uid, idToken: d.idToken, customToken: v.data.customToken };
}

async function main() {
  const browser = await chromium.launch({ headless: !process.env.HEADED, slowMo: process.env.HEADED ? 350 : 0 });
  const ctx = await browser.newContext({
    ...devices["iPhone 13"],
    defaultBrowserType: undefined,
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${page.url()} :: ${m.text()}`); });
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()} :: PAGEERROR ${e.message}`));

  // ───────── A. Public pages (mobile) ─────────
  console.log("\n== A. Public pages @ iPhone 13 ==");
  for (const p of ["/", "/menu", "/biryani", "/catering", "/about", "/contact", "/privacy", "/terms", "/refund-policy", "/delivery-policy", "/login"]) {
    const before = consoleErrors.length;
    const res = await page.goto(BASE + p, { waitUntil: "domcontentloaded" }).catch((e) => ({ status: () => 0, err: e }));
    const status = res.status();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    rec(`A-${p}`, `loads ${status}, no horizontal overflow`, status === 200 && !overflow,
      `${overflow ? "HORIZONTAL OVERFLOW " : ""}${consoleErrors.slice(before).join(" | ").slice(0, 200)}`);
    await page.screenshot({ path: `${OUT}/page${p.replace(/\//g, "_") || "_home"}.png` });
  }
  const razorLegal = [];
  for (const p of ["/privacy", "/terms", "/refund-policy"]) {
    await page.goto(BASE + p);
    if (/razorpay/i.test(await page.content())) razorLegal.push(p);
  }
  rec("A-legal", "legal pages mention the current gateway (Cashfree), not Razorpay", razorLegal.length === 0, razorLegal.join(","));

  // ───────── B. Route guards (unauthenticated) ─────────
  console.log("\n== B. Route guards ==");
  await page.goto(BASE + "/checkout");
  await page.waitForTimeout(1500);
  rec("B-checkout", "/checkout unauthenticated → login", /\/login/.test(page.url()), page.url());
  for (const p of ["/admin", "/kitchen", "/orders"]) {
    await page.goto(BASE + p); await page.waitForTimeout(1500);
    const body = (await page.innerText("body")).slice(0, 300).replace(/\s+/g, " ");
    rec(`B-${p}`, `${p} unauthenticated shows no private data`, !/RK-\d+/.test(body), `${page.url()} :: ${body.slice(0, 100)}`);
  }

  // ───────── C. Login UI (negative then positive) ─────────
  console.log("\n== C. Login UI ==");
  await page.goto(BASE + "/login");
  const phoneInput = page.locator("#op-phone");
  await phoneInput.fill("12345abc");
  rec("C-1", "non-digits stripped / max 10 digits", /^\d*$/.test(await phoneInput.inputValue()), await phoneInput.inputValue());
  await phoneInput.fill("12345");
  rec("C-2", "send-code button disabled for short phone", await page.locator("form button[type=submit]").first().isDisabled());
  await phoneInput.fill("5123456789"); // invalid Indian prefix
  const btn3 = page.locator("form button[type=submit]").first();
  if (await btn3.isDisabled()) {
    rec("C-3", "number starting with 5 blocked (button disabled)", true);
  } else {
    await btn3.click();
    await page.waitForFunction(() => !/Sending/.test(document.querySelector("form button[type=submit]")?.textContent || ""), null, { timeout: 20000 }).catch(() => {});
    const err2 = await page.locator("form").innerText().then((t) => (/valid|invalid|Indian/i.test(t) ? t : "")).catch(() => "");
    rec("C-3", "number starting with 5 rejected", !!err2, err2 || "NO ERROR SHOWN");
  }

  // clear cooldown so the UI flow can request an OTP
  const { execSync } = await import("node:child_process");
  try { execSync("node --env-file=.env.local scripts/clear-test-cooldown.mjs", { stdio: "pipe" }); } catch { /* ignore */ }

  await phoneInput.fill(PHONE);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForFunction(() => !document.querySelector("#op-phone"), null, { timeout: 30000 }).catch(() => {});
  const otpBox = page.locator("input[inputmode=numeric]").first();
  await otpBox.fill("000000");
  await page.locator("form button[type=submit]").first().click();
  await page.waitForTimeout(2000);
  const wrong = await page.locator("[role=alert], .text-chili").first().innerText().catch(() => "");
  rec("C-4", "wrong OTP rejected", /incorrect|invalid|attempt/i.test(wrong), wrong);
  await otpBox.fill(OTP);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForTimeout(2500);
  const signedIn = await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(indexedDB ? {} : {})).length >= 0);
  rec("C-5", "correct OTP signs in & leaves /login", !/\/login/.test(page.url()), page.url());
  await page.screenshot({ path: `${OUT}/after-login.png` });

  // ───────── D. Cart + checkout form (negative) ─────────
  console.log("\n== D. Cart & checkout form ==");
  await page.goto(BASE + "/checkout"); await page.waitForTimeout(1500);
  rec("D-1", "empty cart shows empty state", /cart is empty/i.test(await page.innerText("body")));
  await page.goto(BASE + "/menu", { waitUntil: "domcontentloaded" });
  const addBtn = page.locator("button[aria-label^='Add ']").first();
  await addBtn.click();
  await page.waitForTimeout(500);
  await page.goto(BASE + "/checkout"); await page.waitForTimeout(1500);
  rec("D-2", "cart persists to checkout", !(/cart is empty/i.test(await page.innerText("body"))));
  const payBtn = page.locator("button[type=submit]").last();
  rec("D-3", "Pay disabled until DPDP consent ticked", await payBtn.isDisabled());
  await page.screenshot({ path: `${OUT}/checkout-form.png`, fullPage: true });

  // pickup, fill form
  await page.getByText("Self-Pickup").first().click();
  await page.locator("#name").fill("QA Tester");
  await page.locator("#dpdp-affirmative-consent").check();
  // negative: empty name
  await page.locator("#name").fill("");
  await payBtn.click();
  await page.waitForTimeout(500);
  rec("D-4", "empty name blocked (HTML5 required)", /checkout/.test(page.url()) && (await page.locator("#name:invalid").count()) === 1);
  // negative: short phone
  await page.locator("#name").fill("QA Tester");
  await page.locator("#cphone").fill("12345");
  await payBtn.click();
  await page.waitForTimeout(800);
  const phoneErr = await page.locator("[role=alert]").first().innerText().catch(() => "");
  rec("D-5", "short mobile number rejected (client or server)", !!phoneErr || (await page.locator("#cphone:invalid").count()) === 1,
    phoneErr || "NO VALIDATION on 5-digit mobile");
  await page.locator("#cphone").fill(PHONE);

  // ───────── E. Real Cashfree flow ─────────
  console.log("\n== E. Cashfree checkout (sandbox) ==");
  let createReqBody = null, createResp = null;
  page.on("request", (r) => { if (r.url().endsWith("/api/payments/create-order")) createReqBody = JSON.parse(r.postData() || "{}"); });
  page.on("response", async (r) => { if (r.url().endsWith("/api/payments/create-order") && r.ok()) createResp = await r.json().catch(() => null); });
  await payBtn.click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/cashfree-popup.png` });
  rec("E-1", "create-order succeeded & returns paymentSessionId", !!createResp?.paymentSessionId, JSON.stringify(createResp)?.slice(0, 160));
  const stillOnCheckout = /\/checkout(\?|$)/.test(page.url());
  const frames = page.frames().map((f) => f.url()).filter((u) => /cashfree/.test(u));
  rec("E-2", "payment opens as popup/iframe (not full-page redirect)", stillOnCheckout && frames.length > 0,
    `url=${page.url()} frames=${frames.join(",").slice(0, 150)}`);
  rec("E-3", "response does not leak secret key", !JSON.stringify(createResp || {}).includes(process.env.CASHFREE_SECRET_KEY));

  // E-4 confirm before paying → must NOT create an order
  const cfId = createResp?.cashfreeOrderId;
  let user = await login();
  const unpaid = await api("/api/payments/verify", { token: user.idToken, body: { cashfreeOrderId: cfId } });
  rec("E-4", "verify on UNPAID order refused", unpaid.status >= 400 && !unpaid.data.order, `${unpaid.status} ${unpaid.text.slice(0, 120)}`);

  // E-5 pay in sandbox via API (UPI test VPA)
  const payRes = await fetch("https://sandbox.cashfree.com/pg/orders/sessions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-version": "2023-08-01" },
    body: JSON.stringify({
      payment_session_id: createResp?.paymentSessionId,
      payment_method: { upi: { channel: "collect", upi_id: "testsuccess@gocash" } },
    }),
  });
  const payJson = await payRes.json().catch(() => ({}));
  console.log("sandbox pay response:", payRes.status, JSON.stringify(payJson).slice(0, 300));
  await new Promise((r) => setTimeout(r, 4000));

  await page.goto(`${BASE}/checkout/confirm?order_id=${cfId}`);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/confirm.png`, fullPage: true });
  const confirmText = await page.innerText("body");
  const paidOk = /Payment successful/i.test(confirmText);
  rec("E-5", "after sandbox payment, /checkout/confirm shows success", paidOk, confirmText.replace(/\s+/g, " ").slice(0, 160));

  let orderDocId = null;
  if (paidOk) {
    const r1 = await api("/api/payments/verify", { token: user.idToken, body: { cashfreeOrderId: cfId } });
    const r2 = await api("/api/payments/verify", { token: user.idToken, body: { cashfreeOrderId: cfId } });
    orderDocId = r1.data.order?.id;
    rec("E-6", "verify idempotent (replay returns same order, no duplicate)", r1.data.order?.id && r1.data.order?.id === r2.data.order?.id, `${r1.data.order?.orderId}/${r2.data.order?.orderId}`);
    rec("E-7", "paid order amount matches server total", r1.data.order?.payment?.amount === r1.data.order?.grandTotal, `pay=${r1.data.order?.payment?.amount} total=${r1.data.order?.grandTotal}`);
    rec("E-8", "cart cleared after success", await page.evaluate(() => !/"quantity"/.test(JSON.stringify(localStorage))));
    // other user cannot verify / read my order
    const other = await login("9999999999");
    const steal = await api("/api/payments/verify", { token: other.idToken, body: { cashfreeOrderId: cfId } });
    rec("E-9", "other customer cannot claim my paid order (IDOR)", steal.status === 403 || !steal.data.order, `${steal.status} ${steal.text.slice(0, 100)}`);
    const inv = await api(`/api/orders/${orderDocId}/invoice`, { method: "GET", token: other.idToken });
    rec("E-10", "other customer cannot fetch my invoice", inv.status >= 400, `${inv.status}`);
    const inv2 = await api(`/api/orders/${orderDocId}/invoice`, { method: "GET" });
    rec("E-11", "unauthenticated invoice fetch refused", inv2.status === 401 || inv2.status === 403, `${inv2.status}`);
  }
  await page.goto(BASE + "/orders"); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/orders.png`, fullPage: true });
  if (paidOk) rec("E-12", "paid order visible in My Orders", /RK-\d+/.test(await page.innerText("body")));

  // ───────── F. API security & negative tests ─────────
  console.log("\n== F. API security ==");
  const baseBody = createReqBody;
  const T = user.idToken;
  const co = (b, tok = T) => api("/api/payments/create-order", { token: tok, body: b });

  rec("F-1", "create-order without auth → 401", (await co(baseBody, null)).status === 401);
  rec("F-2", "create-order with garbage token → 401", (await co(baseBody, "abc.def.ghi")).status === 401);
  const tampered = structuredClone(baseBody);
  tampered.items = tampered.items.map((i) => ({ ...i, pricePerUnit: 1, lineTotal: 1 }));
  tampered.clientGrandTotal = 1;
  const t1 = await co(tampered);
  rec("F-3", "client-tampered price (₹1) rejected / ignored", t1.status === 409 || (t1.data.amount && t1.data.amount > 1), `${t1.status} ${t1.text.slice(0, 120)}`);
  const neg = structuredClone(baseBody); neg.items[0].qty = -3; delete neg.clientGrandTotal;
  const n1 = await co(neg);
  rec("F-4", "negative quantity rejected", n1.status >= 400, `${n1.status} ${n1.text.slice(0, 120)}`);
  const big = structuredClone(baseBody); big.items[0].qty = 999999; delete big.clientGrandTotal;
  const b1 = await co(big);
  rec("F-5", "absurd quantity rejected", b1.status >= 400, `${b1.status} ${b1.text.slice(0, 120)}`);
  const frac = structuredClone(baseBody); frac.items[0].qty = 0.5; delete frac.clientGrandTotal;
  const f1 = await co(frac);
  rec("F-6", "fractional quantity rejected", f1.status >= 400, `${f1.status} ${f1.text.slice(0, 120)}`);
  const fakeItem = structuredClone(baseBody); fakeItem.items[0].menuId = "does-not-exist"; delete fakeItem.clientGrandTotal;
  rec("F-7", "unknown menu item rejected", (await co(fakeItem)).status >= 400);
  const past = structuredClone(baseBody); past.mealDate = "2020-01-01"; delete past.clientGrandTotal;
  rec("F-8", "past meal date rejected", (await co(past)).status === 400);
  const del = structuredClone(baseBody); del.fulfillmentType = "delivery"; del.deliveryAddress = "x"; del.addressComponents = { lat: 28.6, lng: 77.2, displayAddress: "Delhi", doorAndBuilding: "1", city: "Delhi", pincode: "110001", state: "Delhi" }; delete del.clientGrandTotal;
  const d1 = await co(del);
  rec("F-9", "out-of-Bengaluru delivery rejected", d1.status === 400 && d1.data.code === "out_of_service_area", `${d1.status} ${d1.text.slice(0, 100)}`);
  const delNoCoords = structuredClone(baseBody); delNoCoords.fulfillmentType = "delivery"; delNoCoords.deliveryAddress = "x"; delete delNoCoords.clientGrandTotal;
  rec("F-10", "delivery without coordinates rejected", (await co(delNoCoords)).status === 400);
  rec("F-11", "malformed JSON handled (no 500 stack)", (await api("/api/payments/create-order", { token: T, raw: "{bad", headers: { "content-type": "application/json" } })).status < 500);
  const xss = structuredClone(baseBody); xss.customerName = "<script>alert(1)</script>"; xss.notes = "<img src=x onerror=alert(1)>"; delete xss.clientGrandTotal;
  const x1 = await co(xss);
  rec("F-12", "XSS payload in name/notes does not crash create-order", x1.status < 500, `${x1.status}`);
  const longNote = structuredClone(baseBody); longNote.notes = "A".repeat(200000); delete longNote.clientGrandTotal;
  const l1 = await co(longNote);
  rec("F-13", "oversized notes (200KB) rejected", l1.status >= 400, `${l1.status} (accepted = unbounded input stored in Firestore)`);
  const extra = structuredClone(baseBody); extra.grandTotal = 1; extra.amount = 1; extra.status = "paid"; delete extra.clientGrandTotal;
  const e1 = await co(extra);
  rec("F-14", "mass-assignment fields (grandTotal/status) ignored", e1.status < 400 ? e1.data.amount > 1 : true, `${e1.status} amount=${e1.data.amount}`);

  // rate limit
  let limited = 0;
  for (let i = 0; i < 8; i++) { const r = await co(baseBody); if (r.status === 429) limited++; }
  rec("F-15", "create-order rate limit kicks in (429)", limited > 0, `429 count=${limited}`);

  // verify route
  rec("F-16", "verify without auth → 401", (await api("/api/payments/verify", { body: { cashfreeOrderId: cfId } })).status === 401);
  rec("F-17", "verify missing id → 400", (await api("/api/payments/verify", { token: T, body: {} })).status === 400);
  const fakeV = await api("/api/payments/verify", { token: T, body: { cashfreeOrderId: "rk-fake-123" } });
  rec("F-18", "verify unknown order id refused, no 500 leak", fakeV.status >= 400 && !/stack|at \w+ \(/.test(fakeV.text), `${fakeV.status} ${fakeV.text.slice(0, 140)}`);
  const inj = await api("/api/payments/verify", { token: T, body: { cashfreeOrderId: "../orders/abc" } });
  rec("F-19", "path-traversal style order id handled", inj.status >= 400 && inj.status < 600, `${inj.status} ${inj.text.slice(0, 120)}`);

  // webhook
  const sign = (ts, raw) => crypto.createHmac("sha256", process.env.CASHFREE_SECRET_KEY).update(ts + raw).digest("base64");
  const wh = (raw, ts, sig) => api("/api/payments/webhook", { raw, headers: { "content-type": "application/json", "x-webhook-timestamp": ts, "x-webhook-signature": sig } });
  const evt = (orderId, cfPay, amt, status = "SUCCESS", type = "PAYMENT_SUCCESS_WEBHOOK") => JSON.stringify({
    type, data: { order: { order_id: orderId, order_amount: amt, order_currency: "INR" }, payment: { cf_payment_id: cfPay, payment_status: status, payment_amount: amt, payment_currency: "INR" } },
  });
  const ts = String(Date.now());
  const rawA = evt("rk-fake-order", "999001", 100);
  rec("F-20", "webhook with NO signature headers → 400", (await api("/api/payments/webhook", { raw: rawA, headers: { "content-type": "application/json" } })).status === 400);
  rec("F-21", "webhook with WRONG signature → 400", (await wh(rawA, ts, "AAAA")).status === 400);
  const w3 = await wh(rawA, ts, sign(ts, rawA));
  rec("F-22", "validly-signed webhook for unknown order → 409 (retryable), no order created", w3.status === 409, `${w3.status} ${w3.text.slice(0, 100)}`);
  const w4 = await wh(rawA, ts, sign(ts, rawA));
  rec("F-23", "webhook replay of same event is deduped / handled", [200, 409].includes(w4.status), `${w4.status} ${w4.text.slice(0, 100)}`);
  const oldTs = String(Date.now() - 24 * 3600 * 1000);
  const rawB = evt("rk-fake-order-2", "999002", 100);
  const w5 = await wh(rawB, oldTs, sign(oldTs, rawB));
  rec("F-24", "webhook with 24h-old timestamp rejected (replay window)", w5.status === 400, `${w5.status} (accepted = no timestamp tolerance)`);
  // amount mismatch on a real intent: use a still-"created" intent
  if (createResp?.cashfreeOrderId) {
    const second = await co(baseBody); // new intent
    if (second.data.cashfreeOrderId) {
      const rawC = evt(second.data.cashfreeOrderId, "999003", 1);
      const w6 = await wh(rawC, ts, sign(ts, rawC));
      const chk = await api("/api/payments/verify", { token: T, body: { cashfreeOrderId: second.data.cashfreeOrderId } });
      rec("F-25", "signed webhook with WRONG amount does not create an order", !chk.data.order, `${w6.status} ${w6.text.slice(0, 100)}`);
      const rawD = evt(second.data.cashfreeOrderId, "999004", second.data.amount);
      const w7 = await wh(rawD, ts, sign(ts, rawD));
      rec("F-26", "BUG-CHECK: signed SUCCESS webhook creates order without Cashfree order actually being PAID (trusts payload only)", true,
        `info only: status ${w7.status}. Safe only if signing secret never leaks.`);
    }
  }

  // other endpoints
  rec("F-27", "borzo estimate without auth → 401", [401, 403].includes((await api("/api/delivery/borzo/estimate", { body: { lat: 12.9, lng: 77.6 } })).status));
  rec("F-28", "borzo book without auth → 401", [401, 403].includes((await api("/api/delivery/borzo", { body: { orderId: "x" } })).status));
  const adm = await api("/api/delivery/borzo", { token: T, body: { orderId: orderDocId || "x" } });
  rec("F-29", "borzo book as normal customer (non-admin) refused", [401, 403].includes(adm.status), `${adm.status} ${adm.text.slice(0, 100)}`);
  rec("F-30", "kitchen prep API without auth refused", [401, 403, 405].includes((await api("/api/kitchen/prep", { body: {} })).status));
  rec("F-31", "borzo webhook with bad signature refused", [400, 401, 403].includes((await api("/api/webhooks/borzo", { body: { x: 1 } })).status));
  rec("F-32", "whatsapp webhook POST with bad signature refused", [400, 401, 403].includes((await api("/api/webhooks/whatsapp", { body: { x: 1 } })).status));
  const mapsNoAuth = await api("/api/maps/autocomplete?q=koramangala", { method: "GET" });
  rec("F-33", "maps autocomplete does not expose raw API key", !/api_key|OLA_MAPS/i.test(mapsNoAuth.text), `${mapsNoAuth.status}`);

  // OTP security
  const otpFlood = [];
  for (let i = 0; i < 4; i++) otpFlood.push((await api("/api/auth/send-otp", { body: { phone: "9876543210" } })).status);
  rec("F-34", "send-otp cooldown enforced (60s)", otpFlood.includes(429), otpFlood.join(","));
  const brute = [];
  for (let i = 0; i < 8; i++) brute.push((await api("/api/auth/verify-otp", { body: { phone: "9876543210", otp: String(100000 + i) } })).status);
  rec("F-35", "verify-otp brute force locked out (429 within 8 tries)", brute.includes(429), brute.join(","));
  const sqli = await api("/api/auth/send-otp", { body: { phone: "' OR 1=1 --" } });
  rec("F-36", "send-otp rejects injection-style phone", sqli.status === 400, `${sqli.status}`);
  const arr = await api("/api/auth/verify-otp", { body: { phone: [PHONE], otp: [OTP] } });
  rec("F-37", "verify-otp rejects array-typed params", arr.status === 400, `${arr.status}`);

  // production test-OTP bypass
  const { readFileSync } = fs;
  const pa = readFileSync("src/lib/server/phoneAuth.ts", "utf8");
  rec("F-38", "SECURITY: static test OTP (123456) gated behind NODE_ENV !== production",
    /NODE_ENV !== "production" && TEST_ACCOUNTS/.test(pa), "phoneAuth.ts TEST_ACCOUNTS");

  // secret leakage in client bundles / pages
  const html = await (await fetch(BASE + "/checkout")).text();
  const chunkUrls = [...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map((m) => m[0]);
  let leaked = false;
  for (const u of new Set(chunkUrls)) {
    const t = await (await fetch(BASE + u)).text();
    if (t.includes(process.env.CASHFREE_SECRET_KEY) || /cfsk_ma_/.test(t)) { leaked = true; break; }
  }
  rec("F-39", "Cashfree secret not present in any client JS chunk", !leaked, `${chunkUrls.length} chunks scanned`);
  const hdr = await fetch(BASE + "/");
  const h = Object.fromEntries(hdr.headers);
  rec("F-40", "security headers present (CSP / X-Frame-Options / nosniff)", !!(h["content-security-policy"] || h["x-frame-options"]) && h["x-content-type-options"] === "nosniff",
    `csp=${!!h["content-security-policy"]} xfo=${h["x-frame-options"]} nosniff=${h["x-content-type-options"]}`);

  rec("Z-console", "no console/page errors across the run", consoleErrors.length === 0, `${consoleErrors.length}: ${[...new Set(consoleErrors)].slice(0, 6).join(" || ").slice(0, 700)}`);

  await browser.close();
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== ${results.length - failed.length}/${results.length} passed, ${failed.length} failed ====`);
}

main().catch((e) => { console.error("FATAL", e); fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2)); process.exit(1); });
