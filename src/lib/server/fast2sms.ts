import "server-only";

interface Fast2SmsSuccessResponse {
  return: true;
  request_id?: string;
  message: string[];
}

interface Fast2SmsErrorResponse {
  return: false;
  message: string[];
}

type Fast2SmsResponse = Fast2SmsSuccessResponse | Fast2SmsErrorResponse;

export interface SendOtpResult {
  success: boolean;
  requestId?: string;
  simulated?: boolean;
}

/** Standard test phone numbers used in E2E tests and staging */
const TEST_PHONE_NUMBERS = new Set(["7411626375", "9999999999", "9876543210"]);

/**
 * Sends a 6-digit OTP code to a 10-digit Indian mobile number using Fast2SMS Quick OTP route.
 * In development or when FAST2SMS_API_KEY is not configured, logs the OTP and simulates delivery
 * so local testing and offline runs never fail.
 */
export async function sendFast2SmsOtp(phone10: string, otp: string): Promise<SendOtpResult> {
  const apiKey = process.env.FAST2SMS_API_KEY;

  // Sandbox / Test / Offline bypass
  if (!apiKey || TEST_PHONE_NUMBERS.has(phone10) || process.env.NODE_ENV !== "production") {
    if (!apiKey) {
      console.warn(
        `[Fast2SMS] FAST2SMS_API_KEY not set. SIMULATING OTP for +91${phone10}: ${otp}`,
      );
      return { success: true, simulated: true };
    }

    if (TEST_PHONE_NUMBERS.has(phone10)) {
      console.info(`[Fast2SMS] Whitelisted test number +91${phone10}: simulated OTP ${otp}`);
      return { success: true, simulated: true };
    }
  }

  const endpoint = "https://www.fast2sms.com/dev/bulkV2";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "otp",
        variables_values: otp,
        numbers: phone10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Fast2SMS] HTTP ${response.status} error:`, errorText);
      throw new Error(`SMS gateway error (${response.status})`);
    }

    const data = (await response.json()) as Fast2SmsResponse;

    if (!data.return) {
      const errMsg = Array.isArray(data.message) ? data.message.join(", ") : "SMS sending failed";
      console.error(`[Fast2SMS] API rejected request:`, data);
      throw new Error(`SMS gateway rejected request: ${errMsg}`);
    }

    return {
      success: true,
      requestId: data.request_id,
      simulated: false,
    };
  } catch (error) {
    console.error("[Fast2SMS] Dispatch failed:", error);
    throw error;
  }
}
