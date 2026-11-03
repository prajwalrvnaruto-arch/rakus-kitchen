import "server-only";
import crypto from "node:crypto";
import { adminAuth, adminDb } from "./firebaseAdmin";
import { normalizeIndianMobile } from "../phone";
import { sendFast2SmsOtp } from "./fast2sms";

const SALT = process.env.FAST2SMS_SECRET_SALT || "rakus-kitchen-fast2sms-salt-v1";
const COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const MAX_HOURLY_REQUESTS = 5;

// Whitelisted test accounts for end-to-end tests
const TEST_ACCOUNTS: Record<string, string> = {
  "7411626375": "123456",
  "9999999999": "123456",
};

interface PhoneVerificationData {
  phone: string;
  hashedOtp: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  sentCountInHour: number;
  firstSentInHourAt: number;
}

function hashOtp(phone10: string, otp: string): string {
  return crypto
    .createHash("sha256")
    .update(`${phone10}:${otp.trim()}:${SALT}`)
    .digest("hex");
}

export class PhoneAuthError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
  }
}

/**
 * Initiates an OTP request for a 10-digit Indian phone number.
 * Enforces rate limiting, cooldowns, and dispatches via Fast2SMS.
 */
export async function requestPhoneOtp(
  phoneRaw: string,
): Promise<{ success: boolean; cooldownSeconds: number; simulated?: boolean }> {
  const { digits10 } = normalizeIndianMobile(phoneRaw);
  if (!digits10) {
    throw new PhoneAuthError("Please enter a valid 10-digit Indian mobile number.", 400);
  }

  const docRef = adminDb().collection("phoneVerifications").doc(digits10);
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as PhoneVerificationData) : null;
  const now = Date.now();

  // Check 60-second cooldown
  if (existing?.lastSentAt) {
    const elapsed = now - existing.lastSentAt;
    if (elapsed < COOLDOWN_MS) {
      const waitSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      throw new PhoneAuthError(
        `Please wait ${waitSeconds}s before requesting another OTP.`,
        429,
      );
    }
  }

  // Check hourly quota (max 5 per hour)
  if (existing?.firstSentInHourAt) {
    const isWithinHour = now - existing.firstSentInHourAt < 60 * 60 * 1000;
    if (isWithinHour && (existing.sentCountInHour || 0) >= MAX_HOURLY_REQUESTS) {
      throw new PhoneAuthError(
        "Too many OTP requests for this number. Please try again in an hour.",
        429,
      );
    }
  }

  // Generate 6-digit OTP
  let otp: string;
  if (TEST_ACCOUNTS[digits10]) {
    otp = TEST_ACCOUNTS[digits10];
  } else {
    otp = crypto.randomInt(100000, 1000000).toString();
  }

  const hashedOtp = hashOtp(digits10, otp);

  // Dispatch via Fast2SMS
  const smsResult = await sendFast2SmsOtp(digits10, otp);

  // Store verification record in Firestore
  const isWithinHour = existing?.firstSentInHourAt && now - existing.firstSentInHourAt < 60 * 60 * 1000;
  const updatedDoc: PhoneVerificationData = {
    phone: digits10,
    hashedOtp,
    createdAt: now,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
    sentCountInHour: isWithinHour ? (existing.sentCountInHour || 1) + 1 : 1,
    firstSentInHourAt: isWithinHour ? existing.firstSentInHourAt : now,
  };

  await docRef.set(updatedDoc);

  return {
    success: true,
    cooldownSeconds: 60,
    simulated: smsResult.simulated,
  };
}

/**
 * Validates a submitted OTP, resolves or creates the corresponding Firebase user,
 * and mints a Firebase Custom Token for customer sign-in.
 */
export async function verifyPhoneOtp(
  phoneRaw: string,
  otp: string,
): Promise<{ customToken: string; uid: string }> {
  const { digits10 } = normalizeIndianMobile(phoneRaw);
  if (!digits10) {
    throw new PhoneAuthError("Please enter a valid 10-digit Indian mobile number.", 400);
  }

  const cleanOtp = otp.trim();
  if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    throw new PhoneAuthError("Please enter a valid 6-digit code.", 400);
  }

  const docRef = adminDb().collection("phoneVerifications").doc(digits10);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new PhoneAuthError("No active OTP request found. Please request a new code.", 404);
  }

  const record = snap.data() as PhoneVerificationData;
  const now = Date.now();

  // Check expiration
  if (now > record.expiresAt) {
    await docRef.delete().catch(() => {});
    throw new PhoneAuthError("This code has expired. Please request a new one.", 400);
  }

  // Check attempt limit
  if (record.attempts >= MAX_ATTEMPTS) {
    await docRef.delete().catch(() => {});
    throw new PhoneAuthError("Too many incorrect attempts. Please request a new OTP.", 429);
  }

  // Validate OTP hash
  const submittedHash = hashOtp(digits10, cleanOtp);
  if (submittedHash !== record.hashedOtp) {
    await docRef.update({ attempts: (record.attempts || 0) + 1 }).catch(() => {});
    const remaining = MAX_ATTEMPTS - (record.attempts + 1);
    throw new PhoneAuthError(
      `Incorrect code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : "Please request a new code."}`,
      400,
    );
  }

  // OTP verified successfully — clean up verification record
  await docRef.delete().catch(() => {});

  // Resolve or create user in Firebase Auth
  const e164Phone = `+91${digits10}`;
  let uid: string;

  try {
    const existingUser = await adminAuth().getUserByPhoneNumber(e164Phone);
    uid = existingUser.uid;
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string; message?: string };
    if (firebaseErr.code === "auth/user-not-found" || firebaseErr.message?.includes("no user record")) {
      const newUser = await adminAuth().createUser({
        phoneNumber: e164Phone,
      });
      uid = newUser.uid;
    } else {
      console.error("[phoneAuth] Error querying Firebase user by phone:", err);
      throw new PhoneAuthError("Failed to resolve user account. Please try again.", 500);
    }
  }

  // Mint Firebase Custom Token
  const customToken = await adminAuth().createCustomToken(uid, {
    authProvider: "fast2sms",
    phoneNumber: e164Phone,
  });

  return { customToken, uid };
}
