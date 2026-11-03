import { NextResponse } from "next/server";
import { requestPhoneOtp, PhoneAuthError } from "@/lib/server/phoneAuth";
import { checkSendOtpRateLimit, clientIp } from "@/lib/server/otpRateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // Route-level IP throttle, on top of phoneAuth.ts's per-phone-number
    // cooldown/quota — stops a single caller from rotating across many
    // phone numbers to drain the Fast2SMS send quota.
    const limited = checkSendOtpRateLimit(clientIp(request));
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const phone = body?.phone;

    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "Please provide a valid 10-digit mobile number." },
        { status: 400 },
      );
    }

    const result = await requestPhoneOtp(phone);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PhoneAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[send-otp route] Unexpected error:", err);
    return NextResponse.json(
      { error: "Could not send verification code. Please try again." },
      { status: 500 },
    );
  }
}
