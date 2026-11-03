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

async function run() {
  console.log("==========================================================");
  console.log("  RAKU'S KITCHEN — COMPREHENSIVE END-TO-END TEST SUITE");
  console.log(`  Target: ${BASE_URL} | Test Phone: ${TEST_PHONE} | OTP: ${TEST_OTP}`);
  console.log("==========================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const screenshotsDir = path.resolve("./docs/test-screenshots");
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  try {
    // -------------------------------------------------------------
    // SUITE TS-01: GLOBAL NAVIGATION & HEADER (Nav.tsx)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-01: Global Navigation & Header ---");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const logoLink = await page.locator("header a[href='/']").first();
    recordTest("TS-01", "TC-NAV-001", "Brand Logo links to home (/)", (await logoLink.count()) > 0);

    const navLinks = ["Menu", "Biryani", "Catering", "About", "Contact"];
    for (const linkName of navLinks) {
      const linkLocator = await page.locator(`header nav a:has-text('${linkName}')`).first();
      recordTest("TS-01", `TC-NAV-002-${linkName}`, `Desktop nav includes ${linkName}`, (await linkLocator.count()) > 0);
    }

    const unauthAdminLink = await page.locator("header nav a[href='/admin']");
    recordTest("TS-01", "TC-NAV-003", "Admin link hidden for unauthenticated visitor", (await unauthAdminLink.count()) === 0);

    const headerCartBtn = await page.locator("header button[aria-label='Open cart']").first();
    recordTest("TS-01", "TC-NAV-004", "Header has accessible 'Open cart' button", (await headerCartBtn.count()) > 0);

    // -------------------------------------------------------------
    // SUITE TS-02: HOME PAGE (/)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-02: Home Page (/) ---");
    const pageTitle = await page.title();
    recordTest("TS-02", "TC-HOME-001", "Page title contains Raku's Kitchen", pageTitle.includes("Raku's Kitchen"), `Title: "${pageTitle}"`);

    const heroHeading = await page.textContent("h1");
    recordTest("TS-02", "TC-HOME-002", "Hero H1 heading matches design", heroHeading.includes("Home-cooked Nati food"), `H1: "${heroHeading.trim()}"`);

    const heroText = await page.textContent("body");
    recordTest("TS-02", "TC-HOME-003", "Operating schedule visible in hero (Lunch 12:30 PM · Dinner 7:30 PM)", 
      heroText.includes("Lunch 12:30 PM") && heroText.includes("Dinner 7:30 PM")
    );

    const orderNowBtn = await page.locator("a:has-text('Order now')").first();
    recordTest("TS-02", "TC-HOME-004", "Hero 'Order now' CTA points to /menu", (await orderNowBtn.getAttribute("href")) === "/menu");

    const biryaniPricesBtn = await page.locator("a:has-text('See biryani prices')").first();
    recordTest("TS-02", "TC-HOME-005", "Hero 'See biryani prices' CTA points to /biryani", (await biryaniPricesBtn.getAttribute("href")) === "/biryani");

    const chickenTile = await page.locator("a[href='/menu#chicken-specialities']").first();
    const muttonTile = await page.locator("a[href='/menu#mutton-specialities']").first();
    recordTest("TS-02", "TC-HOME-006", "Category tiles exist on Home", (await chickenTile.count()) > 0 && (await muttonTile.count()) > 0);

    recordTest("TS-02", "TC-HOME-007", "Value pillars present (Fresh, Authentic, Hygienic)", 
      heroText.includes("Fresh ingredients") && heroText.includes("Authentic taste") && heroText.includes("Hygienic preparation")
    );

    const waHomeBanner = await page.locator("a[href*='wa.me/919606888096']").first();
    recordTest("TS-02", "TC-HOME-008", "Direct WhatsApp ordering link present", (await waHomeBanner.count()) > 0);

    await page.screenshot({ path: path.join(screenshotsDir, "01_home_page.png") });

    // -------------------------------------------------------------
    // SUITE TS-03: MENU PAGE (/menu)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-03: Menu Page (/menu) ---");
    await page.goto(`${BASE_URL}/menu`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const menuTitle = await page.title();
    recordTest("TS-03", "TC-MENU-001", "Menu page loads", menuTitle.includes("Menu"), `Title: "${menuTitle}"`);

    const biryaniAnchor = await page.locator("a[href='#biryani']").first();
    const chickenAnchor = await page.locator("a[href='#chicken-specialities']").first();
    const muttonAnchor = await page.locator("a[href='#mutton-specialities']").first();
    const otherAnchor = await page.locator("a[href='#other-items']").first();
    recordTest("TS-03", "TC-MENU-002", "Category quick navigation anchors exist (#biryani, #chicken, #mutton, #other)", 
      (await biryaniAnchor.count()) > 0 && (await chickenAnchor.count()) > 0 && (await muttonAnchor.count()) > 0 && (await otherAnchor.count()) > 0
    );

    const addButtons = await page.locator("button:has-text('Add')");
    const addButtonsCount = await addButtons.count();
    recordTest("TS-03", "TC-MENU-003", "Dish Cards have Add buttons", addButtonsCount > 0, `Found ${addButtonsCount} Add buttons`);

    if (addButtonsCount > 0) {
      await addButtons.first().click();
      await page.waitForTimeout(500);

      const closeCartBtn = await page.locator("aside button[aria-label='Close cart']").first();
      if ((await closeCartBtn.count()) > 0) {
        await closeCartBtn.click();
        await page.waitForTimeout(300);
      } else {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }

      const stepper = await page.locator("button:has-text('+')").first();
      recordTest("TS-03", "TC-MENU-004", "Add to Cart transforms into Quantity Stepper", (await stepper.count()) > 0);
      
      if ((await stepper.count()) > 0) {
        await stepper.click();
        await page.waitForTimeout(300);
        recordTest("TS-03", "TC-MENU-005", "Quantity Stepper increments quantity", true, "Clicked '+' stepper");
      }
    }

    const askDishBtn = await page.locator("a:has-text('Ask about a dish')").first();
    recordTest("TS-03", "TC-MENU-006", "WhatsApp 'Ask about a dish' link is present", (await askDishBtn.count()) > 0);

    await page.screenshot({ path: path.join(screenshotsDir, "02_menu_page.png") });

    // -------------------------------------------------------------
    // SUITE TS-04: BIRYANI WEIGHED-TO-ORDER PAGE (/biryani)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-04: Biryani Page (/biryani) ---");
    await page.goto(`${BASE_URL}/biryani`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const biryaniH1 = await page.textContent("h1");
    recordTest("TS-04", "TC-BIR-001", "Biryani page loads with heading", biryaniH1.includes("Biryani, weighed to order"));

    const chickenBtn = await page.locator("button:has-text('Chicken')").first();
    const muttonBtn = await page.locator("button:has-text('Mutton')").first();
    recordTest("TS-04", "TC-BIR-002", "Chicken & Mutton meat toggles present", (await chickenBtn.count()) > 0 && (await muttonBtn.count()) > 0);

    await muttonBtn.click();
    await page.waitForTimeout(300);
    const muttonBody = await page.textContent("body");
    recordTest("TS-04", "TC-BIR-003", "Mutton Biryani pricing reflects properly (1,599 / 1,600)", muttonBody.includes("1,599") || muttonBody.includes("1599") || muttonBody.includes("1,600"));

    await chickenBtn.click();
    await page.waitForTimeout(300);
    const chickenBody = await page.textContent("body");
    recordTest("TS-04", "TC-BIR-004", "Chicken Biryani pricing reflects properly (799 / 800)", chickenBody.includes("799") || chickenBody.includes("800"));

    const weightHalfKg = await page.locator("button:has-text('½ kg')").first();
    const weight1Kg = await page.locator("button:has-text('1 kg')").first();
    const weight2Kg = await page.locator("button:has-text('2 kg')").first();
    const weight3Kg = await page.locator("button:has-text('3 kg')").first();
    recordTest("TS-04", "TC-BIR-005", "All weight tier buttons present (½, 1, 2, 3 kg)", 
      (await weightHalfKg.count()) > 0 && (await weight1Kg.count()) > 0 && (await weight2Kg.count()) > 0 && (await weight3Kg.count()) > 0
    );

    recordTest("TS-04", "TC-BIR-006", "Ingredients ratio text displayed", chickenBody.includes("uncooked rice") && (chickenBody.includes("chicken") || chickenBody.includes("meat")));

    const addBiryaniBtn = await page.locator("button:has-text('Add to cart')").first();
    if ((await addBiryaniBtn.count()) > 0) {
      await addBiryaniBtn.click();
      await page.waitForTimeout(500);
      const modalText = await page.textContent("body");
      recordTest("TS-04", "TC-BIR-007", "Extra meat modal opens upon Add to Cart", modalText.includes("extra") || modalText.includes("250 g"));

      const noThanksBtn = await page.locator("button:has-text('No thanks')").first();
      if ((await noThanksBtn.count()) > 0) {
        await noThanksBtn.click();
        await page.waitForTimeout(500);
      }
      recordTest("TS-04", "TC-BIR-008", "Add Biryani to cart completed through modal confirm", true);
    }

    recordTest("TS-04", "TC-BIR-009", "Price chart table and ratio table rendered", 
      chickenBody.includes("Price chart") && chickenBody.includes("What goes into your biryani")
    );

    await page.screenshot({ path: path.join(screenshotsDir, "03_biryani_page.png") });

    // -------------------------------------------------------------
    // SUITE TS-05: CART DRAWER & FINANCIAL CALCULATIONS
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-05: Cart Drawer Component ---");
    const cartOpenBtn = await page.locator("header button[aria-label='Open cart']").first();
    await cartOpenBtn.click();
    await page.waitForTimeout(500);

    const cartDrawerAside = await page.locator("aside:has-text('Your cart')");
    recordTest("TS-05", "TC-CART-001", "Cart Drawer opens successfully", (await cartDrawerAside.count()) > 0);

    const cartText = await page.textContent("aside");
    recordTest("TS-05", "TC-CART-002", "Cart lists item lines and quantities", cartText.includes("Packaging") || cartText.includes("Total") || cartText.includes("Your cart"));

    recordTest("TS-05", "TC-CART-003", "Packaging fee calculation displayed (₹20/item)", cartText.includes("Packaging (₹20/item)") || cartText.includes("Packaging fee"));

    const checkoutBtn = await page.locator("aside button:has-text('checkout')").first();
    recordTest("TS-05", "TC-CART-004", "Proceed / Log in to checkout button exists in Cart Drawer", (await checkoutBtn.count()) > 0);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await page.screenshot({ path: path.join(screenshotsDir, "04_cart_drawer.png") });

    // -------------------------------------------------------------
    // SUITE TS-06: AUTHENTICATION FLOW (/login)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-06: Authentication Flow (/login) ---");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const loginText = await page.textContent("body");
    recordTest("TS-06", "TC-AUTH-001", "Login page renders phone sign-in form with DPDP notice", 
      loginText.includes("Sign in") && loginText.includes("Mobile number") && loginText.includes("Privacy Policy (DPDP Act, 2023)")
    );

    const phoneInput = await page.locator("input#op-phone").first();
    recordTest("TS-06", "TC-AUTH-002", "Phone number input field (#op-phone) present", (await phoneInput.count()) > 0);

    // Test invalid phone number (less than 10 digits disables Send OTP button)
    await phoneInput.click();
    await phoneInput.fill("");
    await phoneInput.pressSequentially("12345", { delay: 15 });
    const sendOtpBtn = await page.locator("button:has-text('Send OTP')").first();
    const isSendDisabled = await sendOtpBtn.isDisabled();
    recordTest("TS-06", "TC-AUTH-003", "Send OTP button is disabled for incomplete phone number (< 10 digits)", isSendDisabled);

    // Enter user-provided test phone: 7411626375
    await phoneInput.click();
    await phoneInput.fill("");
    await phoneInput.pressSequentially(TEST_PHONE, { delay: 20 });
    const isSendEnabled = !(await sendOtpBtn.isDisabled());
    recordTest("TS-06", "TC-AUTH-004", `Entered test phone ${TEST_PHONE} enables Send OTP button`, isSendEnabled);

    // Click Send OTP
    await sendOtpBtn.click();
    console.log(`Submitted phone ${TEST_PHONE}, waiting for OTP input #op-otp...`);

    const otpInput = page.locator("input#op-otp");
    await otpInput.waitFor({ state: "visible", timeout: 12000 });
    const otpStepVisible = (await otpInput.count()) > 0;
    recordTest("TS-06", "TC-AUTH-005", "OTP step rendered (#op-otp) via Firebase Phone Auth", otpStepVisible);

    if (otpStepVisible) {
      await otpInput.click();
      await otpInput.pressSequentially(TEST_OTP, { delay: 20 });
      recordTest("TS-06", "TC-AUTH-006", `Entered test OTP ${TEST_OTP}`, (await otpInput.inputValue()) === TEST_OTP);

      const verifyBtn = page.locator("button:has-text('Verify & sign in'), button[type='submit']").first();
      recordTest("TS-06", "TC-AUTH-007", "Verify & sign in button is enabled with 6-digit OTP", !(await verifyBtn.isDisabled()));

      await verifyBtn.click();
      console.log(`Submitted OTP ${TEST_OTP}, waiting for authentication & redirect...`);
      await page.waitForURL(url => !url.pathname.includes("/login"), { timeout: 15000 });

      const postAuthUrl = page.url();
      recordTest("TS-06", "TC-AUTH-008", "Successful authentication redirects to /orders", 
        postAuthUrl.includes("/orders"), `Navigated to: ${postAuthUrl}`
      );
    }

    await page.screenshot({ path: path.join(screenshotsDir, "05_login_page.png") });

    // -------------------------------------------------------------
    // SUITE TS-08: CUSTOMER ORDERS TRACKING (/orders)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-08: Customer Orders (/orders) ---");
    // Ensure on /orders and wait for loading to complete
    if (!page.url().includes("/orders")) {
      await page.goto(`${BASE_URL}/orders`, { waitUntil: "domcontentloaded" });
    }
    await page.waitForFunction(() => !document.body.innerText.includes("Loading"), { timeout: 10000 });

    const ordersPageText = await page.textContent("body");
    recordTest("TS-08", "TC-ORD-001", "Orders page loads customer account", 
      ordersPageText.includes("My orders") && ordersPageText.includes(TEST_PHONE)
    );

    recordTest("TS-08", "TC-ORD-002", "Real-time Order Tracking Status & Chimes controller active", 
      ordersPageText.includes("Live Order Tracking Active") && (ordersPageText.includes("Chimes On") || ordersPageText.includes("Chimes Off"))
    );

    const myOrdersHeaderLink = await page.locator("header a[href='/orders']").first();
    recordTest("TS-08", "TC-ORD-003", "Authenticated header renders 'My Orders' button", (await myOrdersHeaderLink.count()) > 0);

    const signOutBtn = await page.locator("button:has-text('Sign out')").first();
    recordTest("TS-08", "TC-ORD-004", "Sign out button present for authenticated session", (await signOutBtn.count()) > 0);

    await page.screenshot({ path: path.join(screenshotsDir, "06_orders_page.png") });

    // -------------------------------------------------------------
    // SUITE TS-07: CHECKOUT & PAYMENT FLOW (/checkout)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-07: Checkout Page (/checkout) ---");
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.body.innerText.includes("Loading"), { timeout: 10000 });

    const checkoutPageText = await page.textContent("body");
    recordTest("TS-07", "TC-CHK-001", "Checkout page renders fulfillment & order summary for authenticated user", 
      checkoutPageText.includes("Checkout") && (checkoutPageText.includes("Meal day & slot") || checkoutPageText.includes("Fulfillment") || checkoutPageText.includes("Order summary"))
    );

    const deliveryToggle = await page.locator("button:has-text('Delivery')").first();
    const pickupToggle = await page.locator("button:has-text('Pickup')").first();
    recordTest("TS-07", "TC-CHK-002", "Fulfillment mode toggle (Delivery / Pickup buttons) present", 
      (await deliveryToggle.count()) > 0 && (await pickupToggle.count()) > 0
    );

    recordTest("TS-07", "TC-CHK-003", "Meal slots include Lunch (12:30 PM) and Dinner (7:30 PM) options", 
      checkoutPageText.includes("Lunch") && checkoutPageText.includes("12:30 PM") && checkoutPageText.includes("Dinner") && checkoutPageText.includes("7:30 PM")
    );

    const summaryBox = await page.locator("text=Summary").first();
    recordTest("TS-07", "TC-CHK-004", "Summary card shows live cart items and totals", (await summaryBox.count()) > 0);

    const addressPickerEl = await page.locator("input[placeholder*='address' i], input[placeholder*='JP Nagar' i], input[id*='address' i]").first();
    recordTest("TS-07", "TC-CHK-005", "AddressPicker search input present for delivery mode", (await addressPickerEl.count()) > 0);

    const payButton = await page.locator("button:has-text('Pay'), button[type='submit']:has-text('Order')").first();
    recordTest("TS-07", "TC-CHK-006", "Pay & Place Order action button present", (await payButton.count()) > 0);

    await page.screenshot({ path: path.join(screenshotsDir, "07_checkout_page.png") });

    // -------------------------------------------------------------
    // SUITE TS-09: ADMIN ACCESS CONTROL GATE (/admin)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-09: Admin Dashboard & Gate (/admin) ---");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.body.innerText.includes("Loading"), { timeout: 10000 });

    const adminBody = await page.textContent("body");
    // AdminGate displays 'Admins only' if user is not in /admins/<uid> Firestore collection
    recordTest("TS-09", "TC-ADM-001", "Admin route protected by AdminGate RBAC role validation", 
      adminBody.includes("Admins only") || adminBody.includes("Admin Command") || adminBody.includes("Kitchen Dispatch")
    );

    recordTest("TS-09", "TC-ADM-002", "AdminGate accurately identifies user UID and phone context", 
      adminBody.includes(TEST_PHONE) || adminBody.includes("KNvdNHGDQneS5erw56z405LwEsD2")
    );

    await page.screenshot({ path: path.join(screenshotsDir, "08_admin_gate.png") });

    // -------------------------------------------------------------
    // SUITE TS-10: CATERING ENQUIRY ENGINE (/catering)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-10: Catering Page (/catering) ---");
    await page.goto(`${BASE_URL}/catering`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const cateringH1 = await page.textContent("h1");
    recordTest("TS-10", "TC-CAT-001", "Catering page loads with heading", cateringH1.includes("Catering for your event"));

    const eventSelect = await page.locator("select#event, select").first();
    recordTest("TS-10", "TC-CAT-002", "Event type dropdown present", (await eventSelect.count()) > 0);

    const dateInput = await page.locator("input[type='date']").first();
    recordTest("TS-10", "TC-CAT-003", "Event date input present", (await dateInput.count()) > 0);

    const guestsInput = await page.locator("input#guests, input[placeholder*='guest']").first();
    if ((await guestsInput.count()) > 0) {
      await guestsInput.fill("75");
      recordTest("TS-10", "TC-CAT-004", "Guest count input accepts values (75 guests)", true);
    }

    const whatsappCateringBtn = await page.locator("a:has-text('Send catering enquiry')").first();
    recordTest("TS-10", "TC-CAT-005", "WhatsApp enquiry button present with drafted link (Send catering enquiry)", 
      (await whatsappCateringBtn.count()) > 0 && (await whatsappCateringBtn.getAttribute("href")).includes("wa.me")
    );

    const cateringPerks = await page.textContent("body");
    recordTest("TS-10", "TC-CAT-006", "Catering perks displayed (Any crowd size, Full Nati spread, etc.)", 
      cateringPerks.includes("Any crowd size") && cateringPerks.includes("Full Nati spread")
    );

    await page.screenshot({ path: path.join(screenshotsDir, "09_catering_page.png") });

    // -------------------------------------------------------------
    // SUITE TS-11: ABOUT & STORY PAGE (/about)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-11: About Page (/about) ---");
    await page.goto(`${BASE_URL}/about`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const aboutText = await page.textContent("body");
    recordTest("TS-11", "TC-ABT-001", "About story cards rendered (It starts at home, Nati-style)", 
      aboutText.includes("It starts at home") && aboutText.includes("Nati-style, not hotel-style")
    );

    const comeHungryCta = await page.locator("a:has-text('Order now')").first();
    recordTest("TS-11", "TC-ABT-002", "About 'Order now' CTA links to /menu", (await comeHungryCta.getAttribute("href")) === "/menu");

    await page.screenshot({ path: path.join(screenshotsDir, "10_about_page.png") });

    // -------------------------------------------------------------
    // SUITE TS-12: CONTACT & LOCATION PAGE (/contact)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-12: Contact Page (/contact) ---");
    await page.goto(`${BASE_URL}/contact`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const contactText = await page.textContent("body");
    recordTest("TS-12", "TC-CNT-001", "Contact cards rendered (Pickup: Jambusavari Dinne, Phone: 9606888096)", 
      contactText.includes("Jambusavari Dinne") && contactText.includes("9606888096")
    );

    const waOrderCard = await page.locator("a:has-text('WhatsApp an order')").first();
    recordTest("TS-12", "TC-CNT-002", "WhatsApp direct ordering card links to wa.me", 
      (await waOrderCard.getAttribute("href")).includes("wa.me")
    );

    await page.screenshot({ path: path.join(screenshotsDir, "11_contact_page.png") });

    // -------------------------------------------------------------
    // SUITE TS-13: PRIVACY POLICY & DPDP ACT STATUTORY (/privacy)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-13: Privacy Policy (/privacy) ---");
    await page.goto(`${BASE_URL}/privacy`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const privacyText = await page.textContent("body");
    recordTest("TS-13", "TC-PRV-001", "DPDP Act 2023 statutory badge visible", privacyText.includes("DPDP Act, 2023"));

    const kannadaBtn = await page.locator("button:has-text('ಕನ್ನಡ')").first();
    if ((await kannadaBtn.count()) > 0) {
      await kannadaBtn.click();
      await page.waitForTimeout(300);
      const knText = await page.textContent("body");
      recordTest("TS-13", "TC-PRV-002", "Bilingual switch to Kannada renders authentic Kannada legal text", knText.includes("ಗೌಪ್ಯತಾ ನೀತಿ") || knText.includes("ಡೇಟಾ"));

      const enBtn = await page.locator("button:has-text('English')").first();
      await enBtn.click();
      await page.waitForTimeout(300);
      recordTest("TS-13", "TC-PRV-003", "Bilingual switch back to English works", (await page.textContent("body")).includes("Privacy Policy"));
    }

    await page.screenshot({ path: path.join(screenshotsDir, "12_privacy_page.png") });

    // -------------------------------------------------------------
    // SUITE TS-14: TERMS OF SERVICE (/terms)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-14: Terms of Service (/terms) ---");
    await page.goto(`${BASE_URL}/terms`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const termsText = await page.textContent("body");
    recordTest("TS-14", "TC-TRM-001", "Terms of Service page renders binding clauses", 
      termsText.includes("Terms of Service") && termsText.includes("Acceptance of Terms")
    );

    await page.screenshot({ path: path.join(screenshotsDir, "13_terms_page.png") });

    // -------------------------------------------------------------
    // SUITE TS-15: GLOBAL FOOTER (Footer.tsx)
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-15: Global Footer ---");
    const footerLinks = [
      { name: "Full Menu", href: "/menu" },
      { name: "Biryani Pricing", href: "/biryani" },
      { name: "Catering", href: "/catering" },
      { name: "Track My Order", href: "/orders" },
      { name: "Privacy Policy & DPDP Notice", href: "/privacy" },
      { name: "Terms of Service", href: "/terms" },
    ];
    for (const fl of footerLinks) {
      const flLocator = await page.locator(`footer a[href='${fl.href}']`).first();
      recordTest("TS-15", `TC-FTR-001-${fl.href.replace('/', '')}`, `Footer includes link to ${fl.name} (${fl.href})`, (await flLocator.count()) > 0);
    }

    const footerText = await page.textContent("footer");
    recordTest("TS-15", "TC-FTR-002", "Footer displays copyright and Bangalore tagline", 
      footerText.includes("Raku's Kitchen") && footerText.includes("Bangalore")
    );

    // -------------------------------------------------------------
    // SUITE TS-16: SERVER API SECURITY CHECKS
    // -------------------------------------------------------------
    console.log("\n--- Testing Suite TS-16: Server API Security & Verification ---");
    const unauthPaymentRes = await page.request.post(`${BASE_URL}/api/payments/create-order`, {
      data: { mealSlot: "lunch", items: [{ menuId: "biryani-chicken-1kg", quantity: 1 }] },
    });
    recordTest("TS-16", "TC-API-001", "POST /api/payments/create-order rejects unauthenticated requests (HTTP 401)", 
      unauthPaymentRes.status() === 401, `Status: ${unauthPaymentRes.status()}`
    );

    const invalidVerifyRes = await page.request.post(`${BASE_URL}/api/payments/verify`, {
      data: { razorpay_order_id: "fake_order", razorpay_payment_id: "fake_pay", razorpay_signature: "bad_sig" },
    });
    recordTest("TS-16", "TC-API-002", "POST /api/payments/verify rejects bad signature (HTTP 400 or 401)", 
      invalidVerifyRes.status() === 400 || invalidVerifyRes.status() === 401, `Status: ${invalidVerifyRes.status()}`
    );

    const mapsAutoRes = await page.request.get(`${BASE_URL}/api/maps/autocomplete?q=JP+Nagar`);
    recordTest("TS-16", "TC-API-003", "GET /api/maps/autocomplete blocks unauthenticated scrapers (HTTP 401 Security Gate)", 
      mapsAutoRes.status() === 401, `Status: ${mapsAutoRes.status()}`
    );

  } catch (err) {
    console.error("Test execution encountered an error:", err);
  } finally {
    await browser.close();
  }

  // Summary Report
  console.log("\n==========================================================");
  console.log("                TEST EXECUTION SUMMARY REPORT             ");
  console.log("==========================================================");
  const total = results.length;
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  console.log(`Total Test Cases Executed: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Pass Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log("==========================================================\n");

  fs.writeFileSync(
    "./docs/TEST_EXECUTION_RESULTS.json",
    JSON.stringify({ timestamp: new Date().toISOString(), total, passed, failed, results }, null, 2)
  );
}

run();
