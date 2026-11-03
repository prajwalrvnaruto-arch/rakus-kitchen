import { Suspense } from "react";
import { AdminLoginForm } from "@/components/AdminLoginForm";

export const metadata = { title: "Admin Login · Raku's Kitchen" };

export default function AdminLoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-16">
      <div className="mb-6 text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-greenburn/10 px-3 py-1 text-xs font-bold text-greenburn">
          🔐 Kitchen Management Console
        </span>
        <h1 className="section-title">Admin Sign In</h1>
        <p className="mt-2 text-sm text-soft">
          Sign in with your kitchen administrator email and password to manage orders and kitchen operations.
        </p>
      </div>
      <Suspense fallback={<div className="card p-8 text-center text-sm text-soft">Loading…</div>}>
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
