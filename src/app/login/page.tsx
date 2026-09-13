import { Suspense } from "react";
import { EmailPasswordForm } from "@/components/EmailPasswordForm";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-16">
      <div className="mb-6 text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-turmeric/20 px-3 py-1 text-xs font-bold text-turmerick">
          🍲 Pure Taste of Nati Style
        </span>
        <h1 className="section-title">Sign in to order</h1>
        <p className="mt-2 text-sm text-soft">
          Sign in to place an order and track it live.
        </p>
      </div>
      <Suspense fallback={<div className="card p-8 text-center text-sm text-soft">Loading…</div>}>
        <EmailPasswordForm />
      </Suspense>
    </div>
  );
}