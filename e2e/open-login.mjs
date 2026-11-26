import { chromium, devices } from "playwright";
const ctx = await chromium.launchPersistentContext("/tmp/rk-e2e-profile", {
  headless: false,
  ...devices["iPhone 13"],
  args: ["--remote-debugging-port=9222"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto("http://localhost:3000/login");
console.log("READY at", page.url());
await new Promise(() => {});
