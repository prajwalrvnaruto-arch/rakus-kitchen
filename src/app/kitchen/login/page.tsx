import { Suspense } from "react";
import { KitchenLoginForm } from "@/components/KitchenLoginForm";

export const metadata = { title: "Kitchen Login · Raku's Kitchen" };

export default function KitchenLoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-16">
      <div className="mb-6 text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-turmeric/20 px-3 py-1 text-xs font-bold text-turmerick">
          🍳 Kitchen Prep Sheet
        </span>
        <h1 className="section-title">Kitchen Sign In</h1>
        <p className="mt-2 text-sm text-soft">
          Sign in with your kitchen staff email and password to view the daily prep sheet.
        </p>
      </div>
      <Suspense fallback={<div className="card p-8 text-center text-sm text-soft">Loading…</div>}>
        <KitchenLoginForm />
      </Suspense>
    </div>
  );
}
