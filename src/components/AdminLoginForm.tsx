"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

function getHelperError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password. Please try again.";
    case "auth/too-many-requests":
      return "Access to this account has been temporarily disabled due to many failed login attempts. Please reset your password or try again later.";
    default:
      return (err as Error)?.message || "Something went wrong. Please try again.";
  }
}

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // When already signed in as admin, redirect to destination or /admin
  useEffect(() => {
    if (!loading && user && mountedRef.current) {
      if (isAdmin) {
        const next = searchParams.get("next") ?? "/admin";
        router.replace(next);
      }
    }
  }, [loading, user, isAdmin, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!auth) return;

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Auth context listener will detect user and isAdmin, redirecting above
    } catch (err) {
      if (mountedRef.current) {
        setError(getHelperError(err));
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false);
      }
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

  // If user is already logged in but not an admin
  if (user && !isAdmin && !loading) {
    return (
      <div className="card w-full p-6 sm:p-8 text-center space-y-4">
        <span className="text-4xl" aria-hidden>🔒</span>
        <h2 className="text-lg font-bold text-ink">Account Not Authorized</h2>
        <p className="text-sm text-soft">
          You are currently signed in as <span className="font-semibold text-ink">{user.email ?? user.phoneNumber ?? user.uid}</span>, but this account does not have admin privileges.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <button
            onClick={() => auth?.signOut()}
            className="btn btn-chili text-xs py-2 px-4"
          >
            Sign out & Switch account
          </button>
          <Link href="/orders" className="btn btn-ghost text-xs py-2 px-4">
            Go to Customer Orders
          </Link>
        </div>
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="admin-email" className="mb-1.5 block text-sm font-semibold text-ink">
            Admin email
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="email"
            placeholder="admin@rakuskitchen.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            required
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="admin-password" className="text-sm font-semibold text-ink">
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-xs font-semibold text-soft hover:text-ink transition"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            required
          />
        </div>

        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className="btn btn-greenburn w-full mt-2"
        >
          {busy ? "Signing in…" : "Sign in to Dashboard"}
        </button>

        <div className="border-t border-line/60 pt-4 text-center">
          <Link
            href="/login"
            className="text-xs font-semibold text-soft hover:text-chilidark transition"
          >
            ← Customer? Sign in with mobile number
          </Link>
        </div>
      </form>
    </div>
  );
}
