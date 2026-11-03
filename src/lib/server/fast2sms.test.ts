import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only so vitest doesn't fail
vi.mock("server-only", () => ({}));

import { sendFast2SmsOtp } from "./fast2sms";

describe("sendFast2SmsOtp", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("simulates OTP delivery for whitelisted test phone numbers without network calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await sendFast2SmsOtp("7411626375", "123456");

    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("simulates OTP delivery when FAST2SMS_API_KEY is not set", async () => {
    const prevKey = process.env.FAST2SMS_API_KEY;
    delete process.env.FAST2SMS_API_KEY;

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await sendFast2SmsOtp("9880012345", "654321");

    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    if (prevKey) process.env.FAST2SMS_API_KEY = prevKey;
  });

  it("calls Fast2SMS endpoint when API key is provided and number is non-test in production mode", async () => {
    const prevEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.FAST2SMS_API_KEY = "test_f2s_key";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        return: true,
        request_id: "req_12345",
        message: ["SMS sent successfully."],
      }),
    } as Response);

    const result = await sendFast2SmsOtp("9123456780", "555666");

    expect(result.success).toBe(true);
    expect(result.requestId).toBe("req_12345");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://www.fast2sms.com/dev/bulkV2",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "test_f2s_key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "otp",
          variables_values: "555666",
          numbers: "9123456780",
        }),
      }),
    );

    (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
    delete process.env.FAST2SMS_API_KEY;
  });
});
