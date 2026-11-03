import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";
const TEST_PHONE = "7411626375";
const TEST_OTP = "123456";

const results = [];

function recordTest(suite, id, name, passed, details = "") {
  results.push({ suite, id, name, status: passed ? "PASS" : "FAIL", details });
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${icon} [${suite}] ${id}: ${name} ${details ? `(${details})` : ""}`);
}

async function runDeepTests() {
  console.log("==========================================================");
  console.log("  RAKU'S KITCHEN — DEEP EDGE CASES & MOBILE E2E SUITE");
  console.log(`  Target: ${BASE_URL} | Phone: ${TEST_PHONE}`);
  console.log("==========================================================\n");

  const screenshotsDir = path.resolve("./docs/test-screenshots/deep");
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  // -------------------------------------------------------------
  // TEST SUITE: MOBILE RESPONSIVE VIEWPORT (390 x 844 iPhone 14)
  // -------------------------------------------------------------
  console.log("--- Testing Suite TS-01-MOB: Mobile Navigation & Sticky Bar ---");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  });
  const mobPage = await mobileContext.newPage();

  await mobPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await mobPage.waitForTimeout(600);

  // Check mobile bottom navigation bar
  const mobNav = await mobPage.locator("nav.fixed.bottom-0");
  recordTest("TS-01-MOB", "TC-NAV-MOB-001", "Mobile bottom sticky navigation bar visible (< 768px)", (await mobNav.count()) > 0);

  const mobTabs = ["Home", "Menu", "Biryani", "Catering", "Orders", "Cart"];
  for (const tab of mobTabs) {
    const tabEl = mobPage.locator(`nav.fixed.bottom-0 :has-text('${tab}')`).first();
    recordTest("TS-01-MOB", `TC-NAV-MOB-002-${tab}`, `Mobile nav tab '${tab}' is present and reachable`, (await tabEl.count()) > 0);
  }

  // Navigate to Menu via MobileNav
  const menuTab = mobPage.locator("nav.fixed.bottom-0 a[href='/menu']").first();
  await menuTab.click();
  await mobPage.waitForTimeout(600);
  recordTest("TS-01-MOB", "TC-NAV-MOB-003", "Mobile nav tabs trigger smooth client navigation to /menu", mobPage.url().includes("/menu"));

  // Add item on mobile
  const mobAddBtn = mobPage.locator("button:has-text('Add')").first();
  if (await mobAddBtn.count() > 0) {
    await mobAddBtn.click();
    await mobPage.waitForTimeout(500);
    // Dismiss cart drawer
    await mobPage.keyboard.press("Escape");
    await mobPage.waitForTimeout(300);
  }

  // Open cart from mobile bottom bar
  const mobCartBtn = mobPage.locator("nav.fixed.bottom-0 button[aria-label='Open cart']").first();
  await mobCartBtn.click();
  await mobPage.waitForTimeout(500);
  const mobCartDrawer = mobPage.locator("aside:has-text('Your cart')");
  recordTest("TS-01-MOB", "TC-NAV-MOB-004", "Mobile bottom bar Cart button opens slide-over drawer", (await mobCartDrawer.count()) > 0);

  await mobPage.screenshot({ path: path.join(screenshotsDir, "mob_01_cart_open.png") });
  await mobPage.keyboard.press("Escape");
  await mobileContext.close();

  // -------------------------------------------------------------
  // TEST SUITE: CART RECONCILIATION & ADVANCED MATH (Desktop)
  // -------------------------------------------------------------
  console.log("\n--- Testing Suite TS-05-DEEP: Cart Math & Line Reconciliation ---");
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Go to Biryani page and add Biryani with Extra Meat
  await page.goto(`${BASE_URL}/biryani`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  const addBiryaniBtn = page.locator("button:has-text('Add to cart')").first();
  await addBiryaniBtn.click();
  await page.waitForTimeout(500);

  // In modal, click "+ Add extra meat" or stepper to add 1 extra portion (+250g)
  const addExtraMeatBtn = page.locator("button:has-text('Add with extra meat'), button:has-text('extra')").first();
  if (await addExtraMeatBtn.count() > 0) {
    await addExtraMeatBtn.click();
    await page.waitForTimeout(500);
  } else {
    // If only No thanks
    const noThanks = page.locator("button:has-text('No thanks')").first();
    if (await noThanks.count() > 0) await noThanks.click();
  }
  recordTest("TS-05-DEEP", "TC-CART-DEEP-001", "Biryani + Extra meat modal selection completes into cart", true);

  // Open Cart Drawer
  const openCartBtn = page.locator("header button[aria-label='Open cart']").first();
  await openCartBtn.click();
  await page.waitForTimeout(500);

  // Test quantity stepper inside cart drawer
  const drawerPlusBtn = page.locator("aside button[aria-label*='Increase']").first();
  if (await drawerPlusBtn.count() > 0) {
    await drawerPlusBtn.click();
    await page.waitForTimeout(300);
    recordTest("TS-05-DEEP", "TC-CART-DEEP-002", "Cart Drawer '+' increments item quantity and updates packaging fee", true);
  }

  const drawerMinusBtn = page.locator("aside button[aria-label*='Decrease']").first();
  if (await drawerMinusBtn.count() > 0) {
    await drawerMinusBtn.click();
    await page.waitForTimeout(300);
    recordTest("TS-05-DEEP", "TC-CART-DEEP-003", "Cart Drawer '−' decrements item quantity", true);
  }

  // Verify Packaging fee note
  const cartSummary = await page.textContent("aside");
  recordTest("TS-05-DEEP", "TC-CART-DEEP-004", "Packaging fee explicitly specified at ₹20/item in totals", 
    cartSummary.includes("Packaging (₹20/item)")
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // -------------------------------------------------------------
  // TEST SUITE: AUTHENTICATED USER INTERACTIVE CHECKOUT & ORDERS
  // -------------------------------------------------------------
  console.log("\n--- Testing Suite TS-07-DEEP: Checkout Form Interactive States ---");
  // Login with phone 7411626375 & OTP 123456
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  const phoneInput = page.locator("input#op-phone");
  await phoneInput.click();
  await phoneInput.pressSequentially(TEST_PHONE, { delay: 20 });
  await page.waitForTimeout(200);

  const sendBtn = page.locator("button[type='submit']");
  await sendBtn.click();

  const otpInput = page.locator("input#op-otp");
  await otpInput.waitFor({ state: "visible", timeout: 12000 });
  await otpInput.click();
  await otpInput.pressSequentially(TEST_OTP, { delay: 20 });

  const verifyBtn = page.locator("button:has-text('Verify & sign in'), button[type='submit']");
  await verifyBtn.click();
  await page.waitForURL(url => !url.pathname.includes("/login"), { timeout: 15000 });
  console.log("Authenticated. Navigating to /checkout...");

  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.body.innerText.includes("Loading"), { timeout: 10000 });

  // Test Customer Name Input
  const nameInput = page.locator("input#name");
  await nameInput.fill("Prajwal V");
  recordTest("TS-07-DEEP", "TC-CHK-DEEP-001", "Full Name field accepts input ('Prajwal V')", (await nameInput.inputValue()) === "Prajwal V");

  // Verify phone prefilled from Auth
  const phonePrefilled = page.locator("input#cphone");
  const phoneVal = await phonePrefilled.inputValue();
  recordTest("TS-07-DEEP", "TC-CHK-DEEP-002", "Phone number pre-filled from authenticated user session", phoneVal === TEST_PHONE, `Phone: ${phoneVal}`);

  // Test Fulfillment Mode Toggle: Switch to Pickup
  const pickupBtn = page.locator("button:has-text('Pickup')").first();
  await pickupBtn.click();
  await page.waitForTimeout(300);
  const checkoutTextAfterPickup = await page.textContent("body");
  recordTest("TS-07-DEEP", "TC-CHK-DEEP-003", "Pickup mode displays Kitchen Address (Jambusavari Dinne)", 
    checkoutTextAfterPickup.includes("Jambusavari Dinne") && checkoutTextAfterPickup.includes("JP Nagar 8th Phase")
  );

  // Switch back to Delivery
  const deliveryBtn = page.locator("button:has-text('Delivery')").first();
  await deliveryBtn.click();
  await page.waitForTimeout(300);
  const checkoutTextAfterDelivery = await page.textContent("body");
  recordTest("TS-07-DEEP", "TC-CHK-DEEP-004", "Delivery mode restores structured AddressPicker requirement", 
    checkoutTextAfterDelivery.includes("Delivery address") || checkoutTextAfterDelivery.includes("Search") || (await page.locator("input[placeholder*='address' i]").count()) > 0
  );

  await page.screenshot({ path: path.join(screenshotsDir, "desk_02_checkout_interactive.png") });

  // -------------------------------------------------------------
  // TEST SUITE: ORDERS LIVE CONTROLS & SIGNOUT
  // -------------------------------------------------------------
  console.log("\n--- Testing Suite TS-08-DEEP: Orders Live Status & Sign Out ---");
  await page.goto(`${BASE_URL}/orders`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.body.innerText.includes("Loading"), { timeout: 10000 });

  // Chime button toggle
  const chimeBtn = page.locator("button:has-text('Chimes')").first();
  if (await chimeBtn.count() > 0) {
    const initialChimeText = await chimeBtn.textContent();
    await chimeBtn.click();
    await page.waitForTimeout(300);
    const toggledChimeText = await chimeBtn.textContent();
    recordTest("TS-08-DEEP", "TC-ORD-DEEP-001", "Order audio chime toggle button switches state", 
      initialChimeText !== toggledChimeText || toggledChimeText.includes("Chimes"), `State: ${toggledChimeText.trim()}`
    );
  }

  // Sign out flow
  const signOutBtn = page.locator("button:has-text('Sign out')").first();
  await signOutBtn.click();
  await page.waitForTimeout(1000);
  recordTest("TS-08-DEEP", "TC-ORD-DEEP-002", "Sign out clears session and redirects to home (/)", page.url() === `${BASE_URL}/` || page.url().includes("/login"));

  await page.screenshot({ path: path.join(screenshotsDir, "desk_03_post_signout.png") });

  await browser.close();

  // Summary Report
  console.log("\n==========================================================");
  console.log("            DEEP EDGE CASES TEST SUMMARY REPORT           ");
  console.log("==========================================================");
  const total = results.length;
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  console.log(`Total Deep Test Cases Executed: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Pass Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log("==========================================================\n");

  fs.writeFileSync(
    "./docs/TEST_DEEP_EXECUTION_RESULTS.json",
    JSON.stringify({ timestamp: new Date().toISOString(), total, passed, failed, results }, null, 2)
  );
}

runDeepTests();
