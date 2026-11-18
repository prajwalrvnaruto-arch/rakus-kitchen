import "server-only";

export interface SendOtpResult {
  success: boolean;
  wamid?: string;
  simulated?: boolean;
}

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    public code: number,
    public retryable: boolean,
    public noWhatsApp: boolean = false,
    public configError: boolean = false,
  ) {
    super(message);
  }
}

/** Standard test phone numbers used in E2E tests and staging — never hit the real API. */
const TEST_PHONE_NUMBERS = new Set(["7411626375", "9999999999", "9876543210"]);

// Error codes Meta documents as transient (developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes).
// Carried over from integration-time research — re-verify against the live docs once
// the WABA exists, since Meta has changed/renumbered codes before.
const TRANSIENT_ERROR_CODES = new Set([131000, 131016, 2, 133004]);

// Rate-limit codes — retryable, but only after a short backoff. An immediate
// retry on these just re-triggers the same limit (unlike a bare network blip).
// 130429: throughput limit hit. 131048: spam-rate limit. 131056: pair (business↔user) rate limit.
const RATE_LIMIT_ERROR_CODES = new Set([130429, 131048, 131056]);
const RATE_LIMIT_BACKOFF_MS = 1500;

// Configuration errors — never retryable, and never the customer's fault. Logged
// loudly (distinct prefix) so they surface in production alerting instead of
// blending into routine send failures.
// 132000: template param count/shape mismatch. 132001: template doesn't exist
// for this name+language. 132012: template is paused. 190: access token invalid/expired.
const CONFIG_ERROR_CODES = new Set([132000, 132001, 132012, 190]);

// 131026: undeliverable — the number isn't on WhatsApp, hasn't accepted the latest
// WhatsApp ToS, or the client is too old. Meta deliberately keeps the cause ambiguous;
// treat all three as "this number has no WhatsApp" for UX purposes. Usually arrives
// asynchronously via the statuses webhook (src/app/api/webhooks/whatsapp/route.ts)
// after POST /messages already returned 200 + a wamid, but Meta can also reject it
// synchronously on the send call itself — handle both.
const NO_WHATSAPP_ERROR_CODES = new Set([131026]);

const SEND_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 2;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not configured. Set it once WhatsApp Business Platform setup is complete — see whatsapp_otp_migration_plan.md.`,
    );
  }
  return value;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POSTs a single AUTHENTICATION template send to the Graph API. The OTP code
 * must appear in both the body parameter and the copy-code button parameter
 * (max 15 chars each) — this is Meta's documented shape for authentication
 * templates with an OTP button, re-verify once the template is approved.
 */
async function postOtpTemplate(
  phoneNumberId: string,
  accessToken: string,
  graphVersion: string,
  phone10: string,
  otp: string,
  requestId: string,
): Promise<Response> {
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME || "login_otp";
  const templateLang = process.env.WHATSAPP_OTP_TEMPLATE_LANG || "en_US";
  const endpoint = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

  return fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        // Digits-only, no leading "+" — this is the documented contract for the
        // "to" field (Meta's backend tolerates a "+" and strips it, but doesn't
        // document that as the supported form).
        to: `91${phone10}`,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [
            { type: "body", parameters: [{ type: "text", text: otp }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: otp }] },
          ],
        },
        // Echoed back on status webhooks (value.statuses[].biz_opaque_callback_data) —
        // lets the webhook correlate a delivery event to this specific send.
        biz_opaque_callback_data: requestId,
      }),
    },
    SEND_TIMEOUT_MS,
  );
}

/**
 * Sends a 6-digit OTP to a 10-digit Indian mobile number as a WhatsApp
 * AUTHENTICATION template message, via Meta's Cloud API directly (no BSP).
 *
 * In development, or when WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID are
 * not configured, logs the OTP and simulates delivery so local testing and
 * offline runs never fail. Retries at most once, and only on a network error
 * or an HTTP 5xx/documented-transient code — the OTP itself was already
 * generated by the caller before this function runs, so retrying here
 * redelivers the same code rather than silently issuing a second one.
 */
export async function sendWhatsAppOtp(
  phone10: string,
  otp: string,
  requestId: string,
): Promise<SendOtpResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Sandbox / test / offline bypass
  if (!accessToken || !phoneNumberId || TEST_PHONE_NUMBERS.has(phone10) || process.env.NODE_ENV !== "production") {
    if (!accessToken || !phoneNumberId) {
      console.warn(
        `[WhatsApp] WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID not set. SIMULATING OTP for +91${phone10}: ${otp}`,
      );
      return { success: true, simulated: true };
    }
    if (TEST_PHONE_NUMBERS.has(phone10)) {
      console.info(`[WhatsApp] Whitelisted test number +91${phone10}: simulated OTP ${otp}`);
      return { success: true, simulated: true };
    }
  }

  const graphVersion = requiredEnv("WHATSAPP_GRAPH_API_VERSION");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await postOtpTemplate(phoneNumberId, accessToken, graphVersion, phone10, otp, requestId);
    } catch (err) {
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[WhatsApp] Network error on attempt ${attempt}, retrying:`, err);
        continue;
      }
      throw new WhatsAppSendError("Network error contacting WhatsApp.", -1, true);
    }

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      const wamid: string | undefined = data?.messages?.[0]?.id;
      return { success: true, wamid, simulated: false };
    }

    const data = await response.json().catch(() => ({}));
    const err = (data as { error?: { code?: number; message?: string } })?.error;
    const code = typeof err?.code === "number" ? err.code : response.status;
    const isRateLimit = RATE_LIMIT_ERROR_CODES.has(code);
    const retryable = response.status >= 500 || TRANSIENT_ERROR_CODES.has(code) || isRateLimit;

    if (retryable && attempt < MAX_ATTEMPTS) {
      console.warn(`[WhatsApp] Transient error ${code} on attempt ${attempt}, retrying:`, data);
      // Rate-limit codes need a beat before retrying — an immediate retry just
      // re-trips the same limit, unlike a bare network/5xx blip.
      if (isRateLimit) await delay(RATE_LIMIT_BACKOFF_MS);
      continue;
    }

    const noWhatsApp = NO_WHATSAPP_ERROR_CODES.has(code);
    const configError = CONFIG_ERROR_CODES.has(code);
    if (configError) {
      // Distinct prefix so this is easy to grep/alert on separately from
      // routine per-send failures — this means the WABA setup itself needs
      // attention (bad token, template renamed/paused, etc.), not retrying.
      console.error(`[WhatsApp] CONFIGURATION ERROR ${code} — setup needs attention:`, JSON.stringify(data));
    } else {
      console.error("[WhatsApp] Send failed:", JSON.stringify(data));
    }
    throw new WhatsAppSendError(err?.message || "WhatsApp send failed", code, retryable, noWhatsApp, configError);
  }

  // Unreachable in practice (every loop iteration either returns or throws) —
  // kept so TypeScript doesn't require a fallback return at the function end.
  throw new WhatsAppSendError("WhatsApp send failed after retries.", -1, false);
}
