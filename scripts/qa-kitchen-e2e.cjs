// End-to-end QA for the /kitchen prep sheet, against the running app and the
// LIVE rakus-kitchen Firebase project.
//
//   node --env-file=.env.local scripts/qa-kitchen-e2e.cjs [--headed] [--keep]
//
// What it does:
//  1. Creates two temporary email/password users: one on /kitchenStaff, one with no access.
//  2. Seeds tagged orders (_test: true, _qaRun: <run id>) on dates 10–17 days
//     ahead. Customers can only order up to MAX_ADVANCE_DAYS (7) ahead, so no
//     real order can land on these dates and exact-count checks stay reliable.
//  3. Runs Firestore security-rule checks over REST and UI checks in Chrome.
//  4. Always cleans up (users, /kitchenStaff entry, this run's orders), even on
//     failure. --keep leaves the orders in place for manual inspection.

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");
const { cert, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const KEEP = process.argv.includes("--keep");
const HEADED = process.argv.includes("--headed");
const RUN = `qa-${Date.now().toString(36)}`;
const OUT = path.join(os.tmpdir(), "rk-kitchen-qa", RUN);
fs.mkdirSync(OUT, { recursive: true });

initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
}) });
const db = getFirestore();
const adminAuth = getAuth();
const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

/* ── Dates ─────────────────────────────────────────────────────────────── */

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyToDate = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDaysKey = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate() + n); return dateKey(d); };
const daysBetween = (a, b) => Math.round((keyToDate(b) - keyToDate(a)) / 86400000);
const TODAY = dateKey(new Date());
const D = {
  mixed: addDaysKey(TODAY, 10),
  empty: addDaysKey(TODAY, 11),
  cancelledOnly: addDaysKey(TODAY, 12),
  single: addDaysKey(TODAY, 13),
  perUnit: addDaysKey(TODAY, 14),
  live: addDaysKey(TODAY, 15),
  malformed: addDaysKey(TODAY, 16),
  moveTarget: addDaysKey(TODAY, 17),
};

/* ── Order fixtures ────────────────────────────────────────────────────── */

const CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const shortId = () => `RK-${Array.from({ length: 5 }, () => CHARSET[crypto.randomInt(CHARSET.length)]).join("")}`;
const line = (menuId, name, qty, variant) =>
  ({ menuId, name, qty, pricePerUnit: 100, lineTotal: 100 * qty, ...(variant ? { variant } : {}) });
const cb = (w, q) => line("biryani-chicken", "Chicken Biryani", q, `${w} kg · Chicken`);
const mb = (w, q) => line("biryani-mutton", "Mutton Biryani", q, `${w} kg · Mutton`);
const xc = (q) => line("extra-chicken-250g", "Extra Chicken 250g", q);
const xm = (q) => line("extra-mutton-250g", "Extra Mutton 250g", q);
const LONG_NAME = "Extra Long Dish Name For Overflow Testing On Narrow Phone Screens Without Wrapping Issues";

function orderDoc({ date, slot, status = "Confirmed", items = [], pickup = false, name = "QA order", omit = [], createdAt = Date.now() }) {
  const itemTotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const doc = {
    _test: true, _qaRun: RUN,
    orderId: shortId(), customerId: "TEST-KITCHEN-QA", customerName: `TEST — ${name}`,
    phone: "+910000000000", deliveryAddress: pickup ? "" : "TEST address — 1 Dummy Rd, Bengaluru 560001",
    fulfillmentType: pickup ? "pickup" : "delivery", mealSlot: slot, mealDate: date, items,
    itemTotal, packagingFee: 20, grandTotal: itemTotal + 20, status,
    statusHistory: [{ status, at: createdAt, by: "qa_e2e" }],
    notes: `QA run ${RUN}`, createdAt, updatedAt: createdAt,
  };
  for (const k of omit) delete doc[k];
  return doc;
}

// Fixed createdAt order matters: the page sorts orders newest-first before
// aggregating, which decides the order of same-name rows (e.g. ½ kg vs 1 kg).
const FIXTURES = [
  { key: "mixedL1", date: D.mixed, slot: "Lunch", name: "Mixed L1", items: [cb("½", 4), xc(2)] },
  { date: D.mixed, slot: "Lunch", name: "Mixed L2", items: [cb("½", 6), line("ragi-mudde", "Ragi Mudde", 10)] },
  { date: D.mixed, slot: "Lunch", name: "Mixed L3", items: [cb("1", 5), mb("2", 1), xm(3)] },
  { date: D.mixed, slot: "Lunch", name: "Mixed L4", items: [line("andhra-chilli-chicken", "Chilly Chicken", 2, "½ kg"), line("white-rice", "White Rice", 1, "1 kg"), line("rasam", "Rasam", 2)] },
  { date: D.mixed, slot: "Lunch", name: "Mixed L5 cancelled", status: "Cancelled", items: [cb("1", 9)] },
  { date: D.mixed, slot: "Lunch", name: "Mixed L6 delivered", status: "Delivered", items: [line("guntur-chicken", "Guntur Chicken", 1, "1 kg")] },
  { date: D.mixed, slot: "Lunch", name: "Mixed L7 pickup", status: "Ready for Pickup", pickup: true, items: [mb("½", 2)] },
  { date: D.mixed, slot: "Dinner", name: "Mixed D1", status: "Preparing", items: [line("pepper-mutton", "Mutton Pepper", 2, "1 kg"), line("mutton-chops", "Mutton Chops", 1, "½ kg")] },
  { date: D.mixed, slot: "Dinner", name: "Mixed D2", status: "Out for Delivery", items: [line("fish-fry", "Fish Fry", 3), line("guntur-mutton", "Guntur Mutton", 1, "1 kg")] },
  { date: D.mixed, slot: "Dinner", name: "Mixed D3", items: [cb("3", 1), xc(4), line("raita", "Raita", 2)] },

  { date: D.cancelledOnly, slot: "Lunch", status: "Cancelled", items: [cb("1", 3)] },
  { date: D.cancelledOnly, slot: "Lunch", status: "Cancelled", items: [xc(2)] },
  { date: D.cancelledOnly, slot: "Dinner", status: "Cancelled", items: [mb("½", 1)] },

  { date: D.single, slot: "Lunch", items: [cb("½", 1)] },

  { date: D.malformed, slot: "Lunch", name: "No items field", omit: ["items"] },
  { date: D.malformed, slot: "Lunch", name: "No mealSlot field", omit: ["mealSlot"], items: [line("mystery-dish", "Chef Special", 2)] },
  { date: D.malformed, slot: "Lunch", name: "Odd size", items: [cb("1.5", 2)] },
  { date: D.malformed, slot: "Breakfast", name: "Unknown slot", items: [cb("1", 1)] },
  { date: D.malformed, slot: "Dinner", name: "Huge qty", items: [mb("1", 999)] },
  { date: D.malformed, slot: "Dinner", name: "Long name", items: [line("other-long", LONG_NAME, 1)] },
];
// 50-order day to check volume handling: every order 2 × Ragi Mudde, first one also a Nati Koli Saru.
for (let i = 0; i < 50; i++) {
  FIXTURES.push({ date: D.perUnit, slot: "Lunch", name: `Bulk ${i + 1}`,
    items: [line("ragi-mudde", "Ragi Mudde", 2), ...(i === 0 ? [line("nati-koli-saru", "Nati Koli Saru", 1)] : [])] });
}

/* ── Result tracking ───────────────────────────────────────────────────── */

const results = [];
const icon = { PASS: "✅", FAIL: "❌", "KNOWN BUG": "🐞", INFO: "ℹ️ ", "BUG FIXED?": "❓" };
function record(id, name, status, detail = "") {
  results.push({ id, name, status, detail });
  console.log(`${icon[status]} ${id} ${name}${detail ? ` — ${detail}` : ""}`);
}
async function check(id, name, fn, { knownBug = false } = {}) {
  try {
    const detail = await fn();
    record(id, name, knownBug ? "BUG FIXED?" : "PASS", typeof detail === "string" ? detail : "");
  } catch (e) {
    record(id, name, knownBug ? "KNOWN BUG" : "FAIL", e.message.split("\n")[0].slice(0, 400));
  }
}
const info = (id, name, detail) => record(id, name, "INFO", detail);
function assertEq(actual, expected, label = "value") {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e} but got ${a}`);
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(fn, timeout = 20000) {
  const end = Date.now() + timeout;
  for (;;) {
    try { return await fn(); } catch (e) { if (Date.now() > end) throw e; await sleep(300); }
  }
}

/* ── Page helpers ──────────────────────────────────────────────────────── */

const LABEL_FN = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${date.toLocaleDateString("en-IN", { weekday: "long" })}, ${date.getDate()} ${date.toLocaleDateString("en-IN", { month: "short" })} ${date.getFullYear()}`;
};
const SHORT_FN = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${String(date.getDate()).padStart(2, "0")} ${date.toLocaleDateString("en-IN", { month: "short" })}`;
};
const dateLabel = (page) => page.evaluate(() => document.querySelector("p.font-display")?.textContent.trim() ?? null);

async function goTo(page, state, key) {
  let diff = daysBetween(state.date, key);
  while (diff !== 0) {
    const step = diff > 0 ? 1 : -1;
    await page.getByRole("button", { name: step > 0 ? "Next day" : "Previous day", exact: true }).click();
    state.date = addDaysKey(state.date, step);
    const want = await page.evaluate(LABEL_FN, state.date);
    await page.waitForFunction((w) => document.querySelector("p.font-display")?.textContent.trim() === w, want, { timeout: 10000 });
    diff -= step;
  }
}

// Reads a slot card: header subtitle, expanded state, prep rows, weight totals, footer.
const readSlot = (page, slot) => page.evaluate((slot) => {
  const btn = [...document.querySelectorAll("button[aria-controls]")]
    .find((b) => b.querySelector("h2")?.textContent.includes(`${slot.toUpperCase()} SLOT`));
  if (!btn) throw new Error(`${slot} slot card not rendered`);
  const out = { expanded: btn.getAttribute("aria-expanded"), subtitle: btn.querySelector("p")?.textContent.trim() };
  const panel = document.getElementById(btn.getAttribute("aria-controls"));
  out.panel = !!panel;
  if (!panel) return out;
  const list = panel.children[0];
  out.empty = list.textContent.includes("No orders for this slot yet.");
  out.rows = [...list.children].filter((r) => r.children.length === 2).map((r) => {
    const ps = r.children[0].querySelectorAll("p");
    const variant = ps[0].querySelector("span")?.textContent.trim().replace(/^\(|\)$/g, "") ?? null;
    return [ps[0].childNodes[0]?.textContent.trim(), variant, r.children[1].textContent.replace(/\s+/g, " ").trim(), ps[1]?.textContent.trim() === "Add-on"];
  });
  const w = panel.querySelector(".border-t-2");
  out.weights = w ? [...w.querySelectorAll(".divide-y > div")].map((r) => [r.children[0].textContent.trim(), r.children[1].textContent.trim()]) : null;
  out.footer = panel.textContent.includes("Prep sheet ready for kitchen");
  return out;
}, slot);

async function setOpen(page, slot, open) {
  const s = await readSlot(page, slot);
  if ((s.expanded === "true") !== open) {
    await page.getByRole("button", { name: new RegExp(`${slot.toUpperCase()} SLOT`) }).click();
  }
}

// Polls until the slot matches (absorbs the loading skeleton and live-update lag).
async function expectSlot(page, slot, exp, timeout) {
  const started = Date.now();
  let last;
  try {
    await poll(async () => {
      await setOpen(page, slot, true);
      last = await readSlot(page, slot);
      assertEq(last.subtitle, exp.subtitle, "header");
      if (exp.rows) assertEq(last.rows, exp.rows, "rows");
      if ("weights" in exp) assertEq(last.weights, exp.weights, "weights");
      if ("empty" in exp) assertEq(last.empty, exp.empty, "empty message");
      if ("footer" in exp) assertEq(last.footer, exp.footer, "footer");
    }, timeout);
  } catch (e) {
    throw new Error(e.message);
  }
  return { ms: Date.now() - started, slot: last };
}
const emptySlot = { subtitle: "Combined across 0 orders · 0 total items", rows: [], weights: null, empty: true, footer: false };

/* ── Firestore REST (security rules as seen by a real client) ─────────── */

async function idToken({ email, password }) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json", Referer: `${BASE}/` },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`REST sign-in failed: ${j.error?.message}`);
  return j.idToken;
}
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
async function fsStatus(token, method, p, body) {
  const r = await fetch(FS + p, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Referer: `${BASE}/` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.status;
}
const queryByDate = (date) => ({ structuredQuery: { from: [{ collectionId: "orders" }],
  where: { fieldFilter: { field: { fieldPath: "mealDate" }, op: "EQUAL", value: { stringValue: date } } } } });

/* ── Main ──────────────────────────────────────────────────────────────── */

const users = {};
const seeded = {};

async function setup() {
  const pw = () => crypto.randomBytes(18).toString("base64url");
  users.staff = { email: `qa-kitchen-${RUN}@example.com`, password: pw() };
  users.none = { email: `qa-nostaff-${RUN}@example.com`, password: pw() };
  for (const u of Object.values(users)) {
    u.uid = (await adminAuth.createUser({ email: u.email, password: u.password, emailVerified: true })).uid;
  }
  await db.doc(`kitchenStaff/${users.staff.uid}`).set({ addedAt: FieldValue.serverTimestamp(), addedBy: "qa-e2e", _qaRun: RUN });

  const base = Date.now() - 600000;
  const batch = db.batch();
  FIXTURES.forEach((f, i) => {
    const ref = db.collection("orders").doc();
    if (f.key) seeded[f.key] = ref.id;
    batch.set(ref, orderDoc({ ...f, createdAt: base + i * 1000 }));
  });
  await batch.commit();
  console.log(`Run ${RUN}: 2 temp users, ${FIXTURES.length} orders on ${D.mixed} … ${D.moveTarget}\n`);
}

async function teardown() {
  const snap = await db.collection("orders").where("_qaRun", "==", RUN).get();
  if (!KEEP && !snap.empty) {
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  if (users.staff?.uid) await db.doc(`kitchenStaff/${users.staff.uid}`).delete();
  for (const u of Object.values(users)) if (u.uid) await adminAuth.deleteUser(u.uid).catch(() => {});
  const left = (await db.collection("orders").where("_qaRun", "==", RUN).get()).size;
  console.log(`\nCleanup: ${KEEP ? `kept ${left} orders (--keep)` : `deleted ${snap.size} orders, ${left} left`}; removed kitchenStaff entry and ${Object.keys(users).length} temp users.`);
}

async function precheck() {
  await check("PRE-01", "No real orders exist on the QA dates", async () => {
    for (const d of Object.values(D)) {
      const s = await db.collection("orders").where("mealDate", "==", d).get();
      const real = s.docs.filter((x) => x.data()._qaRun !== RUN).length;
      assert(real === 0, `${real} non-QA orders on ${d}`);
    }
  });
}

async function restTests() {
  const staff = await idToken(users.staff);
  const none = await idToken(users.none);
  const order = `/orders/${seeded.mixedL1}`;
  const expect = (want) => async (got) => assert(got === want, `HTTP ${got}, want ${want}`);
  const cases = [
    // Kitchen staff must NOT read order documents directly — the prep sheet is
    // served by /api/kitchen/prep, which returns aggregates with no customer
    // PII. A direct client read of /orders is denied (closing the PII gap).
    ["SEC-01", "Kitchen staff CANNOT read an order document directly (PII stays server-side)", () => fsStatus(staff, "GET", order), 403],
    ["SEC-02", "Kitchen staff CANNOT query orders by date directly", () => fsStatus(staff, "POST", ":runQuery", queryByDate(D.mixed)), 403],
    ["SEC-03", "Non-staff user cannot read someone else's order", () => fsStatus(none, "GET", order), 403],
    ["SEC-04", "Non-staff user cannot query orders by date", () => fsStatus(none, "POST", ":runQuery", queryByDate(D.mixed)), 403],
    ["SEC-05", "Kitchen staff cannot change an order's status", () => fsStatus(staff, "PATCH", `${order}?updateMask.fieldPaths=status`, { fields: { status: { stringValue: "Delivered" } } }), 403],
    ["SEC-06", "Kitchen staff cannot delete an order", () => fsStatus(staff, "DELETE", order), 403],
    ["SEC-07", "Kitchen staff cannot create an order", () => fsStatus(staff, "POST", "/orders", { fields: { mealDate: { stringValue: D.mixed } } }), 403],
    ["SEC-08", "Kitchen staff cannot grant kitchen access to another user", () => fsStatus(staff, "PATCH", `/kitchenStaff/${users.none.uid}`, { fields: {} }), 403],
    ["SEC-09", "Non-staff user cannot grant themselves kitchen access", () => fsStatus(none, "PATCH", `/kitchenStaff/${users.none.uid}`, { fields: {} }), 403],
    ["SEC-10", "Kitchen staff cannot remove their own access entry", () => fsStatus(staff, "DELETE", `/kitchenStaff/${users.staff.uid}`), 403],
    ["SEC-11", "Kitchen staff cannot make themselves admin", () => fsStatus(staff, "PATCH", `/admins/${users.staff.uid}`, { fields: { role: { stringValue: "admin" } } }), 403],
    ["SEC-12", "Kitchen staff cannot read audit logs", () => fsStatus(staff, "GET", "/auditLogs"), 403],
  ];
  for (const [id, name, call, want] of cases) await check(id, name, async () => expect(want)(await call()));

  // The server endpoint that replaces the direct order read.
  const prep = (token, date) => fetch(`${BASE}/api/kitchen/prep?date=${date}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  await check("API-01", "Kitchen staff CAN load the aggregated prep sheet from /api/kitchen/prep", async () => {
    const r = await prep(staff, D.mixed);
    assert(r.status === 200, `HTTP ${r.status}`);
    const body = await r.json();
    assert(body.lunch && body.dinner, "missing lunch/dinner summaries");
    assert(Array.isArray(body.lunch.rows), "lunch.rows not an array");
  });
  await check("API-02", "Non-staff user CANNOT load the prep sheet (403)", async () => {
    assert((await prep(none, D.mixed)).status === 403, "expected 403 for non-staff");
  });
  await check("API-03", "Unauthenticated request to the prep sheet is rejected (401)", async () => {
    const r = await fetch(`${BASE}/api/kitchen/prep?date=${D.mixed}`);
    assert(r.status === 401, `HTTP ${r.status}, want 401`);
  });
  await check("API-04", "Prep sheet response carries NO customer PII", async () => {
    const raw = await (await prep(staff, D.mixed)).text();
    // The mixed-day fixtures seed customer names/phones/addresses on the orders;
    // none of those strings may appear anywhere in the aggregated response.
    for (const leak of ["customerName", "phone", "deliveryAddress", "addressComponents", "payment", "grandTotal", "customerId"]) {
      assert(!raw.includes(leak), `response leaked field "${leak}"`);
    }
  });
}

async function signIn(browser, user) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/login`);
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.getByRole("button", { name: /Sign in to Dashboard/ }).click();
  await page.getByText("Account Not Authorized").waitFor({ timeout: 20000 });
  return { ctx, page };
}

async function uiTests(browser) {
  /* Access control */
  await check("ACC-01", "Signed-out visitor is sent to /login?next=%2Fkitchen", async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/kitchen`);
    await p.waitForURL(/\/login\?next=%2Fkitchen/, { timeout: 20000 });
    await ctx.close();
  });

  const none = await signIn(browser, users.none);
  await check("ACC-02", "Non-staff user sees the 'Kitchen staff only' lock screen", async () => {
    await none.page.goto(`${BASE}/kitchen`);
    await none.page.getByText("Kitchen staff only").waitFor({ timeout: 20000 });
    await sleep(3000); // give the access listener time to (wrongly) flip
    assert(await none.page.getByText("Kitchen staff only").isVisible(), "lock screen went away");
    assert(!(await none.page.getByText("Kitchen Prep Sheet").count()), "prep sheet rendered for non-staff");
  });
  await check("ACC-03", "Lock screen shows which account is signed in", async () => {
    assert(await none.page.getByText(users.none.email).count(), "email not shown");
  });
  await check("ACC-04", "Kitchen link is hidden in the nav for non-staff", async () => {
    assertEq(await none.page.locator('a[href="/kitchen"]').count(), 0, "kitchen links");
  });
  await check("ACC-05", "'Sign out & Switch' on the lock screen signs out and goes to /login", async () => {
    await none.page.getByRole("button", { name: /Sign out & Switch/ }).click();
    await none.page.waitForURL(/\/login/, { timeout: 15000 });
    await none.page.goto(`${BASE}/kitchen`);
    await none.page.waitForURL(/\/login\?next=%2Fkitchen/, { timeout: 20000 });
  });
  await none.ctx.close();

  const staff = await signIn(browser, users.staff);
  info("ACC-06", "Kitchen staff signing in at /admin/login", "lands on 'Account Not Authorized' and is not sent to /kitchen (only phone login at /login honours ?next=/kitchen)");
  const page = staff.page;
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  await page.addInitScript(() => {
    window.__sawLock = false;
    new MutationObserver(() => {
      if (document.body?.textContent.includes("Kitchen staff only")) window.__sawLock = true;
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });

  await check("ACC-07", "Kitchen staff can open /kitchen", async () => {
    await page.goto(`${BASE}/kitchen`);
    await page.getByText("Kitchen Prep Sheet").waitFor({ timeout: 20000 });
  });
  await check("ACC-08", "Kitchen staff never see the lock screen flash while access loads", async () => {
    assert(!(await page.evaluate(() => window.__sawLock)), "'Kitchen staff only' rendered before the prep sheet");
  });
  await check("ACC-09", "Kitchen link is shown in the nav for kitchen staff", async () => {
    assert((await page.locator('a[href="/kitchen"]').count()) > 0, "no /kitchen link");
  });

  /* Date navigation + default state */
  const state = { date: TODAY };
  await check("NAV-01", "Page opens on today with a 'Today' badge", async () => {
    await poll(async () => assertEq(await dateLabel(page), await page.evaluate(LABEL_FN, TODAY), "date label"));
    assert(await page.getByText("Today", { exact: true }).isVisible(), "no Today badge");
  });
  await check("NAV-02", "'Jump to today' is hidden while on today", async () => {
    assertEq(await page.getByRole("button", { name: "Jump to today" }).count(), 0, "jump button count");
  });
  await check("NAV-03", "Prev/next buttons show yesterday's and tomorrow's dates", async () => {
    const prev = await page.getByRole("button", { name: "Previous day", exact: true }).textContent();
    const next = await page.getByRole("button", { name: "Next day", exact: true }).textContent();
    assert(prev.includes(await page.evaluate(SHORT_FN, addDaysKey(TODAY, -1))), `prev reads "${prev}"`);
    assert(next.includes(await page.evaluate(SHORT_FN, addDaysKey(TODAY, 1))), `next reads "${next}"`);
  });
  await check("UI-01", "Both slots start collapsed", async () => {
    await poll(async () => {
      const l = await readSlot(page, "Lunch"), d = await readSlot(page, "Dinner");
      assertEq([l.expanded, l.panel, d.expanded, d.panel], ["false", false, "false", false], "expanded/panel");
    });
  });

  /* Mixed day: the main aggregation scenario */
  await goTo(page, state, D.mixed);
  await check("NAV-04", "'Jump to today' appears on another date", async () => {
    assert(await page.getByRole("button", { name: "Jump to today" }).isVisible(), "not visible");
    assertEq(await page.getByText("Today", { exact: true }).count(), 0, "Today badge count");
  });
  await check("AGG-01", "Lunch: order + item counts exclude the cancelled order (6 orders, 39 items)", async () => {
    await expectSlot(page, "Lunch", { subtitle: "Combined across 6 orders · 39 total items" });
  });
  await check("AGG-02", "Lunch: rows merged across orders, grouped and sorted Biryani → Chicken → Other → Add-ons", async () => {
    await expectSlot(page, "Lunch", { subtitle: "Combined across 6 orders · 39 total items", rows: [
      ["Chicken Biryani", "1 kg · Chicken", "5 × 1.0 kg", false],
      ["Chicken Biryani", "½ kg · Chicken", "10 × 0.5 kg", false],
      ["Mutton Biryani", "½ kg · Mutton", "2 × 0.5 kg", false],
      ["Mutton Biryani", "2 kg · Mutton", "1 × 2.0 kg", false],
      ["Chilly Chicken", "½ kg", "2 × 0.5 kg", false],
      ["Guntur Chicken", "1 kg", "1 × 1.0 kg", false],
      ["Ragi Mudde", null, "10 × pcs", false],
      ["Rasam", null, "2 × ltr", false],
      ["White Rice", "1 kg", "1 × 1.0 kg", false],
      ["Extra Chicken 250g", null, "2 × unit(s)", true],
      ["Extra Mutton 250g", null, "3 × unit(s)", true],
    ] });
  });
  await check("AGG-03", "Lunch: cancelled order's 9 × 1 kg biryani is not counted", async () => {
    const s = await readSlot(page, "Lunch");
    const row = s.rows.find((r) => r[1] === "1 kg · Chicken");
    assertEq(row?.[2], "5 × 1.0 kg", "Chicken Biryani 1 kg row");
  });
  await check("WGT-01", "Lunch weight totals: ½ kg × 10 + 1 kg × 5 = 10 kg chicken biryani; extra meat at 250 g each", async () => {
    await expectSlot(page, "Lunch", { subtitle: "Combined across 6 orders · 39 total items", weights: [
      ["Chicken Biryani", "10 kg"], ["Mutton Biryani", "3 kg"], ["Chilly Chicken", "1 kg"],
      ["Guntur Chicken", "1 kg"], ["White Rice", "1 kg"], ["Extra Chicken", "0.5 kg"], ["Extra Mutton", "0.75 kg"],
    ], footer: true });
  });
  await check("WGT-02", "Per-unit items (Ragi Mudde, Rasam) stay out of the weight totals", async () => {
    const s = await readSlot(page, "Lunch");
    assert(!s.weights.some(([n]) => n === "Ragi Mudde" || n === "Rasam"), JSON.stringify(s.weights));
  });
  await check("AGG-04", "Dinner: 3 orders, 14 items, statuses Preparing / Out for Delivery / Confirmed all counted", async () => {
    await expectSlot(page, "Dinner", { subtitle: "Combined across 3 orders · 14 total items", rows: [
      ["Chicken Biryani", "3 kg · Chicken", "1 × 3.0 kg", false],
      ["Guntur Mutton", "1 kg", "1 × 1.0 kg", false],
      ["Mutton Chops", "½ kg", "1 × 0.5 kg", false],
      ["Mutton Pepper", "1 kg", "2 × 1.0 kg", false],
      ["Fish Fry", null, "3 × 1.0 kg", false],
      ["Raita", null, "2 × ½ ltr", false],
      ["Extra Chicken 250g", null, "4 × unit(s)", true],
    ], weights: [
      ["Chicken Biryani", "3 kg"], ["Guntur Mutton", "1 kg"], ["Mutton Chops", "0.5 kg"],
      ["Mutton Pepper", "2 kg"], ["Fish Fry", "3 kg"], ["Extra Chicken", "1 kg"],
    ] });
  });
  await check("BUG-01", "Fish Fry (sold per kg, no size option) shows as 3 kg and in the weight totals", async () => {
    const s = await readSlot(page, "Dinner");
    const row = s.rows.find((r) => r[0] === "Fish Fry");
    assert(row?.[2].includes("kg"), `row reads "${row?.[2]}"`);
    assert(s.weights?.some(([n]) => n === "Fish Fry"), "Fish Fry missing from Total by weight");
  });
  await check("BUG-02", "Guntur Mutton is listed with the mutton dishes, not under Other Items", async () => {
    const names = (await readSlot(page, "Dinner")).rows.map((r) => r[0]);
    assert(names.indexOf("Guntur Mutton") < names.indexOf("Fish Fry"), `order is ${names.join(", ")}`);
  });
  await page.screenshot({ path: path.join(OUT, "mixed-day-desktop.png"), fullPage: true });

  /* Expand / collapse behaviour */
  await check("UI-02", "Slots open and close independently", async () => {
    await setOpen(page, "Dinner", false);
    await poll(async () => {
      const l = await readSlot(page, "Lunch"), d = await readSlot(page, "Dinner");
      assertEq([l.expanded, d.expanded, d.panel], ["true", "false", false], "lunch/dinner state");
    });
  });
  await check("UI-03", "Clicking an open slot's header collapses it", async () => {
    await page.getByRole("button", { name: /LUNCH SLOT/ }).click();
    await poll(async () => assertEq((await readSlot(page, "Lunch")).panel, false, "lunch panel"));
  });
  await check("UI-04", "Collapsed header still shows order and item counts", async () => {
    assertEq((await readSlot(page, "Lunch")).subtitle, "Combined across 6 orders · 39 total items", "header");
  });
  await check("UI-05", "Keyboard: Enter opens and Space closes a slot", async () => {
    await page.getByRole("button", { name: /LUNCH SLOT/ }).focus();
    await page.keyboard.press("Enter");
    await poll(async () => assertEq((await readSlot(page, "Lunch")).expanded, "true", "after Enter"));
    await page.keyboard.press("Space");
    await poll(async () => assertEq((await readSlot(page, "Lunch")).expanded, "false", "after Space"));
  });
  await check("UI-06", "Header exposes aria-expanded and aria-controls pointing at the panel", async () => {
    await setOpen(page, "Lunch", true);
    await poll(async () => {
      const ok = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button[aria-controls]")].find((x) => x.textContent.includes("LUNCH SLOT"));
        return b.getAttribute("aria-expanded") === "true" && !!document.getElementById(b.getAttribute("aria-controls"));
      });
      assert(ok, "aria wiring broken");
    });
  });

  /* Empty / cancelled-only / single / bulk days */
  await goTo(page, state, D.empty);
  await poll(async () => assert((await readSlot(page, "Lunch")).subtitle.includes("0 orders"), "still loading"));
  const afterNav = await readSlot(page, "Lunch");
  info("UI-07", "Open/closed state after changing date", afterNav.expanded === "true" ? "kept open" : "resets to collapsed on every date change (both slots)");
  await check("EDGE-01", "Empty day: both slots show 0 orders and 'No orders for this slot yet.'", async () => {
    await expectSlot(page, "Lunch", emptySlot);
    await expectSlot(page, "Dinner", emptySlot);
  });
  await check("EDGE-02", "Empty day: no 'Total by weight' or 'Prep sheet ready' footer", async () => {
    const s = await readSlot(page, "Lunch");
    assertEq([s.weights, s.footer], [null, false], "weights/footer");
  });

  await goTo(page, state, D.cancelledOnly);
  await check("EDGE-03", "Day where every order is cancelled looks the same as an empty day", async () => {
    await expectSlot(page, "Lunch", emptySlot);
    await expectSlot(page, "Dinner", emptySlot);
  });

  await goTo(page, state, D.single);
  await check("EDGE-04", "Single order, single item: singular 'order', one row, one weight line", async () => {
    await expectSlot(page, "Lunch", { subtitle: "Combined across 1 order · 1 total item",
      rows: [["Chicken Biryani", "½ kg · Chicken", "1 × 0.5 kg", false]], weights: [["Chicken Biryani", "0.5 kg"]] });
    await expectSlot(page, "Dinner", emptySlot);
  });
  await check("EDGE-05", "Item count wording is singular for a single item ('1 total item')", async () => {
    assertEq((await readSlot(page, "Lunch")).subtitle, "Combined across 1 order · 1 total item", "header");
  });

  await goTo(page, state, D.perUnit);
  await check("EDGE-06", "50 orders in one slot: counts and sums stay exact (50 orders, 101 items)", async () => {
    const { ms } = await expectSlot(page, "Lunch", { subtitle: "Combined across 50 orders · 101 total items",
      rows: [["Nati Koli Saru", null, "1 × whole bird(s)", false], ["Ragi Mudde", null, "100 × pcs", false]], footer: true });
    return `rendered in ${ms} ms`;
  });
  await check("EDGE-07", "Slot with only per-unit items shows no 'Total by weight' section", async () => {
    assertEq((await readSlot(page, "Lunch")).weights, null, "weights");
  });

  /* Live updates (no reload) */
  await goTo(page, state, D.live);
  await check("LIVE-00", "Live day starts empty", async () => { await expectSlot(page, "Lunch", emptySlot); });
  const live = db.collection("orders").doc();
  await live.set(orderDoc({ date: D.live, slot: "Lunch", name: "Live L1", items: [cb("½", 2)] }));
  await check("LIVE-01", "New order appears without a reload", async () => {
    const { ms } = await expectSlot(page, "Lunch", { subtitle: "Combined across 1 order · 2 total items", weights: [["Chicken Biryani", "1 kg"]] });
    return `${ms} ms`;
  });
  await live.update({ items: [cb("½", 4)] });
  await check("LIVE-02", "Quantity change on an order updates rows and kg totals", async () => {
    const { ms } = await expectSlot(page, "Lunch", { subtitle: "Combined across 1 order · 4 total items",
      rows: [["Chicken Biryani", "½ kg · Chicken", "4 × 0.5 kg", false]], weights: [["Chicken Biryani", "2 kg"]] });
    return `${ms} ms`;
  });
  await live.update({ status: "Cancelled" });
  await check("LIVE-03", "Cancelling an order removes it from the sheet", async () => {
    const { ms } = await expectSlot(page, "Lunch", emptySlot);
    return `${ms} ms`;
  });
  await live.update({ status: "Confirmed", mealSlot: "Dinner" });
  await check("LIVE-04", "Moving an order from Lunch to Dinner moves it between slots", async () => {
    await expectSlot(page, "Lunch", emptySlot);
    await expectSlot(page, "Dinner", { subtitle: "Combined across 1 order · 4 total items" });
  });
  await live.update({ mealDate: D.moveTarget });
  await check("LIVE-05", "Moving an order to another date removes it from this date", async () => {
    await expectSlot(page, "Dinner", emptySlot);
  });
  const live2 = db.collection("orders").doc();
  await live2.set(orderDoc({ date: D.live, slot: "Dinner", name: "Live D1", items: [xm(1), line("rasam", "Rasam", 1)] }));
  await check("LIVE-06", "Order with only an add-on and a per-unit item: 0.25 kg extra mutton", async () => {
    await expectSlot(page, "Dinner", { subtitle: "Combined across 1 order · 2 total items", weights: [["Extra Mutton", "0.25 kg"]] });
  });
  await live2.delete();
  await check("LIVE-07", "Deleting an order removes it from the sheet", async () => {
    await expectSlot(page, "Dinner", emptySlot);
  });

  /* Malformed data */
  await goTo(page, state, D.malformed);
  await check("DATA-01", "Malformed lunch data renders without crashing (missing items, missing slot, odd size)", async () => {
    await expectSlot(page, "Lunch", { subtitle: "Combined across 3 orders · 4 total items", rows: [
      ["Chicken Biryani", "1.5 kg · Chicken", "2 × 1.5 kg", false],
      ["Chef Special", null, "2 × unit(s)", false],
    ] });
  });
  await check("DATA-02", "Order with no mealSlot is counted under Lunch", async () => {
    const s = await readSlot(page, "Lunch");
    assert(s.rows.some((r) => r[0] === "Chef Special"), "Chef Special missing");
  });
  await check("DATA-03", "Odd size '1.5 kg' biryani still counts toward the weight totals (3 kg)", async () => {
    const s = await readSlot(page, "Lunch");
    assertEq(s.weights, [["Chicken Biryani", "3 kg"]], "weights");
  });
  await check("DATA-04", "999 × 1 kg biryani shows 999 kg", async () => {
    await expectSlot(page, "Dinner", { subtitle: "Combined across 2 orders · 1000 total items",
      rows: [["Mutton Biryani", "1 kg · Mutton", "999 × 1.0 kg", false], [LONG_NAME, null, "1 × unit(s)", false]],
      weights: [["Mutton Biryani", "999 kg"]] });
  });
  info("DATA-05", "Order with an unknown mealSlot ('Breakfast')", "is not shown in either slot and nothing warns about it");

  /* Moved order lands on its new date */
  await goTo(page, state, D.moveTarget);
  await check("LIVE-08", "Order moved to another date shows up on that date", async () => {
    await expectSlot(page, "Dinner", { subtitle: "Combined across 1 order · 4 total items",
      rows: [["Chicken Biryani", "½ kg · Chicken", "4 × 0.5 kg", false]] });
  });
  await check("NAV-05", "'Jump to today' returns to today and hides itself", async () => {
    await page.getByRole("button", { name: "Jump to today" }).click();
    state.date = TODAY;
    await poll(async () => assertEq(await dateLabel(page), await page.evaluate(LABEL_FN, TODAY), "date label"));
    assert(await page.getByText("Today", { exact: true }).isVisible(), "no Today badge");
    assertEq(await page.getByRole("button", { name: "Jump to today" }).count(), 0, "jump button count");
  });
  await check("NAV-06", "Going back one day from today works (past dates are viewable)", async () => {
    await goTo(page, state, addDaysKey(TODAY, -1));
    await poll(async () => { await readSlot(page, "Lunch"); });
  });

  /* Mobile */
  const m = await staff.ctx.newPage();
  await m.setViewportSize({ width: 375, height: 812 });
  await m.goto(`${BASE}/kitchen`);
  await m.getByText("Kitchen Prep Sheet").waitFor({ timeout: 20000 });
  const mState = { date: TODAY };
  await goTo(m, mState, D.mixed);
  await check("MOB-01", "Phone width (375 px): busy day has no sideways scroll with both slots open", async () => {
    await expectSlot(m, "Lunch", { subtitle: "Combined across 6 orders · 39 total items" });
    await expectSlot(m, "Dinner", { subtitle: "Combined across 3 orders · 14 total items" });
    const over = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(over <= 0, `page is ${over}px wider than the screen`);
  });
  await m.screenshot({ path: path.join(OUT, "mixed-day-mobile.png"), fullPage: true });
  await goTo(m, mState, D.malformed);
  await check("MOB-02", "Phone width: very long dish name wraps instead of overflowing", async () => {
    await expectSlot(m, "Dinner", { subtitle: "Combined across 2 orders · 1000 total items" });
    const over = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(over <= 0, `page is ${over}px wider than the screen`);
  });
  await m.screenshot({ path: path.join(OUT, "long-name-mobile.png"), fullPage: true });
  await m.close();

  /* Access changes while the page is open */
  await page.goto(`${BASE}/kitchen`);
  await page.getByText("Kitchen Prep Sheet").waitFor({ timeout: 20000 });
  await db.doc(`kitchenStaff/${users.staff.uid}`).delete();
  await check("ACC-10", "Removing kitchen access locks an open page without a reload", async () => {
    const t = Date.now();
    await page.getByText("Kitchen staff only").waitFor({ timeout: 20000 });
    return `${Date.now() - t} ms`;
  });
  await db.doc(`kitchenStaff/${users.staff.uid}`).set({ addedAt: FieldValue.serverTimestamp(), addedBy: "qa-e2e", _qaRun: RUN });
  await check("ACC-11", "Re-granting access unlocks the open page without a reload", async () => {
    const t = Date.now();
    await page.getByText("Kitchen Prep Sheet").waitFor({ timeout: 20000 });
    return `${Date.now() - t} ms`;
  });
  await check("ACC-12", "Header 'Sign out' signs out; /kitchen then sends to login", async () => {
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL((u) => u.pathname === "/", { timeout: 15000 });
    await page.goto(`${BASE}/kitchen`);
    await page.waitForURL(/\/login\?next=%2Fkitchen/, { timeout: 20000 });
  });

  const uniq = [...new Set(consoleErrors)];
  info("CON-01", "Browser console errors on the staff session", uniq.length ? `${uniq.length} distinct: ${uniq.slice(0, 4).map((s) => s.slice(0, 160)).join(" | ")}` : "none");
  await staff.ctx.close();
}

(async () => {
  let browser;
  let crashed = null;
  try {
    await setup();
    await precheck();
    await restTests();
    browser = await chromium.launch({ channel: "chrome", headless: !HEADED });
    await uiTests(browser);
  } catch (e) {
    crashed = e;
    console.error(`\n✗ Run aborted: ${e.stack}`);
  } finally {
    await browser?.close().catch(() => {});
    await teardown().catch((e) => console.error("✗ Cleanup failed:", e.message));
    fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ run: RUN, dates: D, results }, null, 2));
    const count = (s) => results.filter((r) => r.status === s).length;
    console.log(`\n${count("PASS")} passed, ${count("FAIL")} failed, ${count("KNOWN BUG")} known bugs confirmed, ${count("BUG FIXED?")} bug checks now passing, ${count("INFO")} observations`);
    console.log(`Screenshots + results.json: ${OUT}`);
    process.exit(crashed || count("FAIL") ? 1 : 0);
  }
})();
