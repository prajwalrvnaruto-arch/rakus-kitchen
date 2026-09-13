"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function helperText(err: unknown, resetting = false): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return resetting
        ? "If that account exists, a reset link is on its way."
        : "Wrong email or password. Try again.";
    case "auth/email-already-in-use":
      return "This email is already registered — try signing in instead.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function EmailPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Forgot-password state: showReset morphs the form into a reset-email sender.
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Already signed in → redirect.
  useEffect(() => {
    if (!loading && user && mountedRef.current) {
      const next = searchParams.get("next") ?? "/orders";
      router.replace(next);
    }
  }, [loading, user, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const addr = email.trim();

    if (!EMAIL_RE.test(addr)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!auth) return;

    setBusy(true);
    try {
      if (showReset) {
        // Ask Firebase to email a password-reset link. Firebase's default reset
        // email is sent automatically — no template or SMTP setup needed.
        await sendPasswordResetEmail(auth, addr);
        if (mountedRef.current) setResetSent(true);
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, addr, password);
      } else {
        await signInWithEmailAndPassword(auth, addr, password);
      }
      // onAuthStateChanged fires → redirect effect above handles navigation.
    } catch (err) {
      if (mountedRef.current) setError(helperText(err, showReset));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
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
      {resetSent && (
        <p className="mb-4 rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm font-medium text-ok" role="status">
          ✓ We sent a password-reset link to <strong>{email.trim()}</strong>. Check your
          inbox (and the spam folder) — it expires within the hour.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-chili/30 bg-chili/5 px-4 py-3 text-sm font-medium text-chili" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="ep-email" className="mb-1.5 block text-sm font-semibold">
            Email address
          </label>
          <input
            id="ep-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            required
          />
        </div>
        {!showReset && (
          <div>
            <label htmlFor="ep-password" className="mb-1.5 block text-sm font-semibold">
              Password
            </label>
            <input
              id="ep-password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              required
              minLength={6}
            />
            {!isSignUp && (
              <button
                type="button"
                onClick={() => {
                  setShowReset(true);
                  setResetSent(false);
                  setError(null);
                }}
                className="mt-1.5 text-xs font-semibold text-chilidark underline underline-offset-2 hover:text-ink"
              >
                Forgot password?
              </button>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={busy || !email.trim() || (!showReset && !password)}
          className="btn btn-chili w-full"
        >
          {busy
            ? "Please wait…"
            : showReset
              ? "Send reset link"
              : isSignUp
                ? "Create account"
                : "Sign in"}
        </button>
        {showReset && (
          <p className="text-center text-xs text-soft">
            We&apos;ll email you a link to set a new password for{" "}
            <strong>{email.trim() || "your account"}</strong>.
          </p>
        )}
      </form>

      <p className="mt-4 text-center text-xs text-soft">
        {showReset ? (
          <button
            type="button"
            onClick={() => {
              setShowReset(false);
              setResetSent(false);
              setError(null);
            }}
            className="font-semibold text-chilidark underline underline-offset-2 hover:text-ink"
          >
            ← Back to sign in
          </button>
        ) : isSignUp ? (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(null); }}
              className="font-semibold text-chilidark underline underline-offset-2 hover:text-ink"
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            New here?{" "}
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(null); }}
              className="font-semibold text-chilidark underline underline-offset-2 hover:text-ink"
            >
              Create an account
            </button>
          </>
        )}
      </p>
    </div>
  );
}
