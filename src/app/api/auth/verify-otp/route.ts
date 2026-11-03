import { NextResponse } from "next/server";
import { verifyPhoneOtp, PhoneAuthError } from "@/lib/server/phoneAuth";
import { checkVerifyOtpRateLimit, clientIp } from "@/lib/server/otpRateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // Route-level IP throttle — stops brute-forcing the 6-digit code across
    // many phone numbers from one caller. phoneAuth.ts's own per-phone
    // MAX_ATTEMPTS (5) still caps guesses against any single number.
    const limited = checkVerifyOtpRateLimit(clientIp(request));
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const { phone, otp } = body ?? {};

    if (!phone || typeof phone !== "string" || !otp || typeof otp !== "string") {
      return NextResponse.json(
        { error: "Phone number and 6-digit OTP code are required." },
        { status: 400 },
      );
    }

    const { customToken, uid } = await verifyPhoneOtp(phone, otp);
    return NextResponse.json({ customToken, uid });
  } catch (err) {
    if (err instanceof PhoneAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[verify-otp route] Unexpected error:", err);
    return NextResponse.json(
      { error: "Verification failed. Please check the code and try again." },
      { status: 500 },
    );
  }
}
