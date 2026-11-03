import { describe, it, expect } from "vitest";
import { generateRandomOrderId, isValidOrderId, ORDER_ID_CHARSET } from "./orderId";

describe("generateRandomOrderId (Option A: 5-char alphanumeric Swiggy/Zomato style)", () => {
  it("generates an ID matching the format RK-XXXXX", () => {
    const id = generateRandomOrderId();
    expect(id).toMatch(/^RK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
  });

  it("never includes ambiguous characters (0, O, 1, I)", () => {
    // Test 1000 generated IDs to ensure no ambiguous characters leak
    const ambiguousChars = ["0", "O", "1", "I"];
    for (let i = 0; i < 1000; i++) {
      const id = generateRandomOrderId();
      for (const char of ambiguousChars) {
        expect(id).not.toContain(char);
      }
    }
  });

  it("produces high entropy without rapid collisions in sample space", () => {
    const set = new Set<string>();
    const count = 5000;
    for (let i = 0; i < count; i++) {
      set.add(generateRandomOrderId());
    }
    // With 33.5 million combinations, 5,000 samples should have almost zero collisions (>= 4990 unique)
    expect(set.size).toBeGreaterThanOrEqual(count - 5);
  });

  it("has exactly length 8 (3 prefix chars + 5 code chars)", () => {
    const id = generateRandomOrderId();
    expect(id.length).toBe(8);
    expect(id.startsWith("RK-")).toBe(true);
  });

  it("validates both Option A IDs and legacy sequential IDs", () => {
    expect(isValidOrderId("RK-8M4KP")).toBe(true);
    expect(isValidOrderId("RK-9Z2XW")).toBe(true);
    expect(isValidOrderId("RK-00001")).toBe(true);
    expect(isValidOrderId("RK-00028")).toBe(true);

    // Invalid IDs
    expect(isValidOrderId("")).toBe(false);
    expect(isValidOrderId("RK-")).toBe(false);
    expect(isValidOrderId("RK-123")).toBe(false); // too short
    expect(isValidOrderId("RK-0ABCD")).toBe(false); // contains '0' which is excluded from Option A
    expect(isValidOrderId("INV-12345")).toBe(false); // wrong prefix
  });
});
