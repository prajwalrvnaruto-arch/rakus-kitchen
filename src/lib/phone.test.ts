import { describe, it, expect } from "vitest";
import { normalizeIndianMobile, toWaIntl, toLocal10 } from "./phone";
import { phoneToIntl } from "./whatsapp";
import { toPorterPhone } from "./porterDeepLink";

describe("normalizeIndianMobile", () => {
  it("resolves common stored formats to bare 10 digits", () => {
    expect(normalizeIndianMobile("+91 96068 88096").digits10).toBe("9606888096");
    expect(normalizeIndianMobile("9606888096").digits10).toBe("9606888096");
    expect(normalizeIndianMobile("919606888096").digits10).toBe("9606888096");
    expect(normalizeIndianMobile("091-96068-88096").digits10).toBe("9606888096");
    expect(normalizeIndianMobile("09606888096").digits10).toBe("9606888096"); // leading 0 trunk
  });

  it("fails loudly (null) for anything that isn't a valid Indian mobile", () => {
    expect(normalizeIndianMobile("").digits10).toBeNull();
    expect(normalizeIndianMobile(undefined).digits10).toBeNull();
    expect(normalizeIndianMobile("12345").digits10).toBeNull(); // too short
    expect(normalizeIndianMobile("1234567890").digits10).toBeNull(); // starts with 1
    expect(normalizeIndianMobile("5606888096").digits10).toBeNull(); // starts with 5
    expect(normalizeIndianMobile("abcdefghij").digits10).toBeNull();
  });
});

describe("toWaIntl / phoneToIntl", () => {
  it("prefixes 91 for wa.me links", () => {
    expect(toWaIntl("+91 96068 88096")).toBe("919606888096");
    expect(phoneToIntl("9606888096")).toBe("919606888096");
    expect(phoneToIntl("919606888096")).toBe("919606888096");
  });

  it("returns empty string for unresolvable input (no more broken links)", () => {
    // Previously phoneToIntl echoed short input back; now it fails loudly.
    expect(phoneToIntl("12345")).toBe("");
    expect(toWaIntl("not a phone")).toBe("");
  });
});

describe("toLocal10 / toPorterPhone", () => {
  it("returns bare 10 digits for Porter's Receiver's Mobile field", () => {
    expect(toPorterPhone("+91 96068 88096")).toBe("9606888096");
    expect(toPorterPhone("919606888096")).toBe("9606888096");
    expect(toLocal10("9606888096")).toBe("9606888096");
  });

  it("returns empty string instead of a silently-truncated wrong number", () => {
    // An 11-digit non-prefixed string used to lose its leading digit via slice(-10).
    expect(toPorterPhone("99606888096")).toBe(""); // 11 digits, not a valid form → empty
    expect(toPorterPhone("12345")).toBe("");
  });
});
