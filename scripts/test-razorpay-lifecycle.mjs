import { chromium } from "playwright";
import crypto from "node:crypto";
import fs from "fs";
import path from "path";
import { readFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "http://localhost:3000";
const TEST_PHONE = "7411626375";
const TEST_OTP = "123456";

// Test secrets from .env.local
const RAZORPAY_KEY_ID = "rzp_test_Tf8ITbsIuVQQkr";
const RAZORPAY_KEY_SECRET = "jweVN0CgYXU9ex6UXrpMID81";
const RAZORPAY_WEBHOOK_SECRET = "aX8JBa_kiDu4G9J";

const results = [];
function recordTest(id, name, passed, details = "") {
  results.push({ id, name, status: passed ? "PASS" : "FAIL", details });
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${icon} [Razorpay-Lifecycle] ${id}: ${name} ${details ? `(${details})` : ""}`);
}

function computeWebhookSignature(bodyString) {
  return crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(bodyString).digest("hex");
}

function computePaymentSignature(orderId, paymentId) {
  return crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

/**
 * Mint a Firebase Custom Token via Admin SDK, then exchange it for an ID token
 * via the Firebase Auth REST API (signInWithCustomToken endpoint).
 * This avoids needing to import @/lib/firebase inside page.evaluate (which
 * can't resolve Next.js path aliases).
 */
async function getFirebaseIdToken(adminDb, adminAuth, firebaseApiKey) {
  // Firebase Auth users are created by phoneAuth.ts with phoneNumber = "+91XXXXXXXXXX"
  // Mirror that exact lookup so we always get the right UID.
  const e164Phone = `+91${TEST_PHONE}`;
  let uid;
  try {
    const userRecord = await adminAuth.getUserByPhoneNumber(e164Phone);
    uid = userRecord.uid;
  } catch {
    // User doesn't exist yet — create them (mirrors phoneAuth.ts createUser path)
    const newUser = await adminAuth.createUser({ phoneNumber: e164Phone });
    uid = newUser.uid;
  }

  // Mint a Firebase custom token for this UID, then exchange for an ID token
  // via the Firebase Auth REST API — avoids needing @/lib/firebase in Playwright.
  const customToken = await adminAuth.createCustomToken(uid);
  const restRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const restData = await restRes.json();
  if (!restData.idToken) throw new Error(`Firebase ID token exchange failed: ${JSON.stringify(restData)}`);
  return restData.idToken;
}

async function run() {
  console.log("==========================================================");
  console.log("   RAKU'S KITCHEN — RAZORPAY SANDBOX & WEBHOOK TEST SUITE ");
  console.log(`   Host: ${BASE_URL} | Test Phone: ${TEST_PHONE}`);
  console.log("==========================================================\n");

  // -------------------------------------------------------------
  // PRE-FLIGHT: Parse .env.local and init Admin SDK (shared)
  // -------------------------------------------------------------
  const envContent = readFileSync(resolve(".env.local"), "utf-8");
  const env = {};
  for (const line of envContent.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx === -1) continue;
    let val = t.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    env[t.slice(0, idx).trim()] = val;
  }

  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getAuth: getAdminAuth } = await import("firebase-admin/auth");
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: (env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  }
  const adminDb = getFirestore();
  const adminAuth = getAdminAuth();
  const firebaseApiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;

  // Clear OTP cooldown so test is always repeatable
  console.log("--- Pre-flight: Clearing OTP cooldown for test phone ---");
  try {
    await adminDb.collection("phoneVerifications").doc(TEST_PHONE).delete();
    console.log(`✅ OTP cooldown cleared for ${TEST_PHONE}\n`);
  } catch (pfErr) {
    console.warn(`⚠️  Could not clear OTP cooldown (continuing anyway): ${pfErr.message}\n`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const screenshotsDir = path.resolve("./docs/test-screenshots/razorpay");
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  try {
    // -------------------------------------------------------------
    // STEP 1: AUTHENTICATE TEST USER
    // -------------------------------------------------------------
    console.log("--- Step 1: Authenticating test customer ---");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    // Ensure React has hydrated before interacting
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);

    // Use fill() for React controlled inputs — more reliable than pressSequentially
    const phoneInput = page.locator("input#op-phone");
    await phoneInput.waitFor({ state: "visible", timeout: 10000 });
    await phoneInput.fill(TEST_PHONE);
    // Wait for submit button to become enabled (React updates disabled state after fill)
    const submitBtn = page.locator("button[type='submit']");
    await submitBtn.waitFor({ state: "visible", timeout: 5000 });
    await page.waitForFunction(() => {
      const btn = document.querySelector("button[type='submit']");
      return btn && !btn.disabled;
    }, { timeout: 8000 }).catch(() => {});
    await submitBtn.click();

    const otpInput = page.locator("input#op-otp");
    await otpInput.waitFor({ state: "visible", timeout: 15000 });
    await otpInput.fill(TEST_OTP);
    // Wait for Verify button to become enabled (otp.length === 6)
    await page.waitForFunction(() => {
      const btn = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Verify"));
      return btn && !btn.disabled;
    }, { timeout: 8000 }).catch(() => {});
    const verifyBtn = page.locator("button:has-text('Verify & sign in')");
    await verifyBtn.click();
    await page.waitForURL(url => !url.pathname.includes("/login"), { timeout: 20000 });
    recordTest("RZP-AUTH-001", "Customer logged in with test phone credentials", true);

    // -------------------------------------------------------------
    // STEP 2: CREATE RAZORPAY ORDER VIA /api/payments/create-order
    // -------------------------------------------------------------
    console.log("\n--- Step 2: Creating Razorpay Sandbox Order via /api/payments/create-order ---");

    // Get Firebase ID token in Node.js (avoids @/lib/firebase alias in browser)
    const idToken = await getFirebaseIdToken(adminDb, adminAuth, firebaseApiKey);

    // Select a safe orderable date (skip Monday=1, Thursday=4)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    if (tomorrow.getDay() === 1) tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getDay() === 4) tomorrow.setDate(tomorrow.getDate() + 1);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mealDate = `${days[tomorrow.getDay()]}, ${tomorrow.getDate()} ${months[tomorrow.getMonth()]}`;

    const createOrderRes = await page.request.post(`${BASE_URL}/api/payments/create-order`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      data: JSON.stringify({
        customerName: "Prajwal V",
        phone: TEST_PHONE,
        fulfillmentType: "pickup",
        mealSlot: "Lunch",
        mealDate,
        items: [{ menuId: "biryani-chicken", name: "Chicken Biryani", variant: "1 kg · Chicken", qty: 1 }],
      }),
    });

    const createOrderData = await createOrderRes.json();
    const createOrderResponse = { status: createOrderRes.status(), data: createOrderData };
    console.log("Create order response:", createOrderResponse);

    const rzpOrderId = createOrderData.razorpayOrderId;
    const amountPaise = createOrderData.amount;

    recordTest("RZP-ORD-001", "Server created real Razorpay order ID",
      createOrderRes.status() === 200 && typeof rzpOrderId === "string" && rzpOrderId.startsWith("order_"),
      `Order ID: ${rzpOrderId}, Amount: ₹${amountPaise / 100}`
    );
    recordTest("RZP-ORD-002", "Server enforced canonical price + packaging fee",
      amountPaise === 81900,
      `Calculated: ₹${amountPaise / 100} (expected ₹819)`
    );

    // -------------------------------------------------------------
    // STEP 3: TEST WEBHOOK SECURITY GUARDS (/api/payments/webhook)
    // -------------------------------------------------------------
    console.log("\n--- Step 3: Testing Razorpay Webhook Security Gates ---");
    
    // 3A: Missing / Invalid Signature
    const invalidSigRes = await page.request.post(`${BASE_URL}/api/payments/webhook`, {
      data: JSON.stringify({ event: "payment.captured" }),
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": "bogus_hex_signature_123456",
      },
    });
    recordTest("RZP-WHK-001", "Webhook rejects invalid HMAC signature (HTTP 400)", 
      invalidSigRes.status() === 400, `Status: ${invalidSigRes.status()}`
    );

    // 3B: Missing Signature Header
    const missingSigRes = await page.request.post(`${BASE_URL}/api/payments/webhook`, {
      data: JSON.stringify({ event: "payment.captured" }),
      headers: { "Content-Type": "application/json" },
    });
    recordTest("RZP-WHK-002", "Webhook rejects missing signature header (HTTP 400)", 
      missingSigRes.status() === 400, `Status: ${missingSigRes.status()}`
    );

    // -------------------------------------------------------------
    // STEP 4: SIMULATE RAZORPAY WEBHOOK CAPTURE (Asynchronous Payment Backstop)
    // -------------------------------------------------------------
    console.log("\n--- Step 4: Simulating payment.captured Webhook Event ---");

    const simPaymentId = `pay_sim_${Date.now()}`;
    const webhookPayload = JSON.stringify({
      entity: "event",
      account_id: "acc_test",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: simPaymentId,
            entity: "payment",
            amount: amountPaise,
            currency: "INR",
            status: "captured",
            order_id: rzpOrderId,
            method: "upi",
            captured: true,
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    });

    const validWebhookSig = computeWebhookSignature(webhookPayload);
    const webhookRes = await page.request.post(`${BASE_URL}/api/payments/webhook`, {
      data: webhookPayload,
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": validWebhookSig,
      },
    });

    const webhookBody = await webhookRes.json();
    console.log("Webhook capture response:", webhookRes.status(), webhookBody);
    recordTest("RZP-WHK-003", "Valid signed payment.captured webhook materializes order (HTTP 200)", 
      webhookRes.status() === 200 && webhookBody.ok === true, `Response: ${JSON.stringify(webhookBody)}`
    );

    // -------------------------------------------------------------
    // STEP 5: TEST WEBHOOK REPLAY & DEDUPLICATION IDEMPOTENCY
    // -------------------------------------------------------------
    console.log("\n--- Step 5: Testing Webhook Replay & Deduplication ---");
    const replayedWebhookRes = await page.request.post(`${BASE_URL}/api/payments/webhook`, {
      data: webhookPayload,
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": validWebhookSig,
      },
    });
    const replayedBody = await replayedWebhookRes.json();
    console.log("Replayed webhook response:", replayedWebhookRes.status(), replayedBody);
    recordTest("RZP-WHK-004", "Replayed webhook recognized as duplicate (deduped: true)", 
      replayedWebhookRes.status() === 200 && replayedBody.deduped === true, `Response: ${JSON.stringify(replayedBody)}`
    );

    // -------------------------------------------------------------
    // STEP 6: TEST CLIENT VERIFY ROUTE IDEMPOTENCY (/api/payments/verify)
    // -------------------------------------------------------------
    console.log("\n--- Step 6: Testing /api/payments/verify Idempotent Retrieval ---");
    const clientVerifySig = computePaymentSignature(rzpOrderId, simPaymentId);

    const clientVerifyRes = await page.request.post(`${BASE_URL}/api/payments/verify`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      data: JSON.stringify({
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: simPaymentId,
        razorpay_signature: clientVerifySig,
      }),
    });
    const clientVerifyData = await clientVerifyRes.json();
    const clientVerifyResponse = { status: clientVerifyRes.status(), data: clientVerifyData };
    console.log("Client verify response after webhook:", clientVerifyResponse);
    const finalizedOrder = clientVerifyData.order;
    recordTest("RZP-VER-001", "Client /verify safely returns existing finalized order",
      clientVerifyRes.status() === 200 && finalizedOrder && finalizedOrder.status === "Confirmed",
      `Order: ${finalizedOrder?.orderId}, Status: ${finalizedOrder?.status}`
    );

    // -------------------------------------------------------------
    // STEP 7: VERIFY ORDER IN UI (/orders) & REAL-TIME DISPATCH ALARM
    // -------------------------------------------------------------
    console.log("\n--- Step 7: Verifying live order in UI on /orders ---");
    await page.goto(`${BASE_URL}/orders`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.body.innerText.includes("Loading"), { timeout: 10000 });
    await page.waitForTimeout(1000);

    const ordersPageText = await page.textContent("body");
    const orderRendered = ordersPageText.includes("Confirmed") && ordersPageText.includes("₹819");
    recordTest("RZP-UI-001", "Confirmed order immediately visible on customer /orders page with status 'Confirmed'", 
      orderRendered, `Found status 'Confirmed' and ₹819 total on /orders`
    );

    const whatsappBtn = await page.locator("a:has-text('Send Order to Kitchen on WhatsApp'), a:has-text('WhatsApp')").first();
    recordTest("RZP-UI-002", "WhatsApp direct kitchen confirmation button rendered on order card", 
      (await whatsappBtn.count()) > 0
    );

    await page.screenshot({ path: path.join(screenshotsDir, "01_order_confirmed_ui.png") });

    // -------------------------------------------------------------
    // STEP 8: TEST PAYMENT FAILED WEBHOOK LIFECYCLE
    // -------------------------------------------------------------
    console.log("\n--- Step 8: Simulating payment.failed Webhook Lifecycle ---");
    const failedPayload = JSON.stringify({
      entity: "event",
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: `pay_fail_${Date.now()}`,
            amount: 81900,
            status: "failed",
            order_id: `order_fail_${Date.now()}`,
          },
        },
      },
    });
    const failedSig = computeWebhookSignature(failedPayload);
    const failedRes = await page.request.post(`${BASE_URL}/api/payments/webhook`, {
      data: failedPayload,
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": failedSig,
      },
    });
    const failedBody = await failedRes.json();
    recordTest("RZP-WHK-005", "payment.failed webhook event processed without crashing (HTTP 200)", 
      failedRes.status() === 200 && failedBody.ok === true
    );

  } catch (err) {
    console.error("Razorpay Lifecycle Test error:", err);
  } finally {
    await browser.close();
  }

  // Summary Report
  console.log("\n==========================================================");
  console.log("       RAZORPAY LIFECYCLE & WEBHOOK TEST SUMMARY          ");
  console.log("==========================================================");
  const total = results.length;
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  console.log(`Total Scenarios Tested: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Pass Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log("==========================================================\n");

  fs.writeFileSync(
    "./docs/RAZORPAY_LIFECYCLE_TEST_RESULTS.json",
    JSON.stringify({ timestamp: new Date().toISOString(), total, passed, failed, results }, null, 2)
  );
}

run();
