"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

type Step = "phone" | "otp";

export function PhoneOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => (c > 1 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Already signed in → redirect.
  useEffect(() => {
    if (!loading && user && mountedRef.current) {
      const next = searchParams.get("next") ?? "/orders";
      router.replace(next);
    }
  }, [loading, user, router, searchParams]);

  const sendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    if (!auth) return;

    const cleanPhone = phone.replace(/[^\d]/g, "");
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code.");
      }

      if (!mountedRef.current) return;
      setCooldown(data.cooldownSeconds ?? 60);
      setStep("otp");
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!auth) return;

    const cleanOtp = otp.replace(/[^\d]/g, "").slice(0, 6);
    if (cleanOtp.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/[^\d]/g, ""), otp: cleanOtp }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      // Complete sign in with Firebase custom token
      await signInWithCustomToken(auth, data.customToken);
      // onAuthStateChanged fires → redirect effect above handles navigation.
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const changeNumber = () => {
    setStep("phone");
    setOtp("");
    setError(null);
  };

  if (!auth) {
    return (
      <div className="rounded-xl border border-chili/30 bg-chili/5 p-4 text-center text-sm text-chili">
        Firebase isn&apos;t configured yet — copy <code>.env.local.example</code> to{" "}
        <code>.env.local</code> and add your Firebase web-app keys.
      </div>
    );
  }

  return (
    <div className="card w-full p-6 sm:p-8">
      {error && (
        <p className="mb-4 rounded-xl border border-chili/30 bg-chili/5 px-4 py-3 text-sm font-medium text-chili" role="alert">
          {error}
        </p>
      )}

      {step === "phone" ? (
        <form onSubmit={sendOtp} className="space-y-4">
          <div>
            <label htmlFor="op-phone" className="mb-1.5 block text-sm font-semibold">
              Mobile number
            </label>
            <div className="flex items-center gap-2">
              <span className="field flex w-16 items-center justify-center px-0 text-sm text-soft">
                +91
              </span>
              <input
                id="op-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                className="field"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy || phone.length !== 10}
            className="btn btn-chili w-full"
          >
            {busy ? "Sending code…" : "Send OTP"}
          </button>
          <div className="space-y-3 pt-1 text-center">
            <p className="text-[11px] leading-relaxed text-soft">
              By signing in, you confirm you are 18+ years of age, agree to our{" "}
              <Link href="/terms" className="text-chilidark underline hover:text-ink">
                Terms of Service
              </Link>{" "}
              and acknowledge our{" "}
              <Link href="/privacy" className="text-chilidark underline hover:text-ink">
                Privacy Policy (DPDP Act, 2023)
              </Link>.
            </p>
            <div className="border-t border-line/60 pt-3">
              <Link
                href="/admin/login"
                className="text-xs font-semibold text-soft hover:text-chilidark transition"
              >
                Kitchen Staff & Admin? Sign in with Email →
              </Link>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="space-y-4">
          <div>
            <label htmlFor="op-otp" className="mb-1.5 block text-sm font-semibold">
              Enter the 6-digit code
            </label>
            <p className="mb-2 text-xs text-soft">
              Sent to <strong>+91 {phone}</strong>.{" "}
              <button
                type="button"
                onClick={changeNumber}
                className="font-semibold text-chilidark underline underline-offset-2 hover:text-ink"
              >
                Change number
              </button>
            </p>
            <input
              id="op-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
              className="field tracking-widest text-center text-lg font-mono font-bold"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy || otp.length !== 6}
            className="btn btn-chili w-full"
          >
            {busy ? "Verifying…" : "Verify & sign in"}
          </button>

          <div className="text-center pt-2">
            {cooldown > 0 ? (
              <span className="text-xs text-soft">
                Resend OTP in <strong className="font-semibold text-ink">{cooldown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => sendOtp()}
                disabled={busy}
                className="text-xs font-semibold text-chilidark underline underline-offset-2 hover:text-ink"
              >
                Resend OTP
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
