"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { isKitchenSigningOut } from "@/components/kitchenSignOut";

/**
 * Kitchen staff authentication gate — wraps the /kitchen page. Shows loading
 * state while auth is initializing, redirects to login if not signed in,
 * and shows a "kitchen staff only" message if the user is signed in but not
 * on the kitchen staff allowlist (admins automatically pass: isKitchen || isAdmin).
 */
export function KitchenGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isKitchen, isAdmin, accessResolved } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect in an effect, never during render — redirecting during render
  // triggers React's "update a component while rendering another" warning and
  // races with other navigations (e.g. the page's own Sign out → "/").
  // Only bounce to login while we're still on a kitchen route: an explicit
  // sign-out that navigates away (header "Sign out" → "/") has already left
  // /kitchen, and must not be yanked to /login.
  useEffect(() => {
    // Stand down if the user is deliberately signing out of the kitchen — the
    // header is already navigating to "/", and racing it to /login would cancel
    // that. A genuine signed-out visit (flag not raised) still redirects.
    if (!loading && !user && pathname?.startsWith("/kitchen") && !isKitchenSigningOut()) {
      router.replace("/login?next=%2Fkitchen");
    }
  }, [loading, user, router, pathname]);

  // Show a neutral placeholder while anything is still settling:
  //  - auth session restoring (loading)
  //  - signed out and about to be redirected by the effect above (!user)
  //  - signed in but the allowlist flags haven't reported yet (!accessResolved)
  // Waiting on accessResolved is what stops the "Kitchen staff only" lock
  // screen flashing for real staff whose isKitchen flag arrives a tick late.
  if (loading || !user || !accessResolved) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-center text-soft">Loading…</div>;
  }

  // Signed in but neither kitchen staff nor admin — explain why and offer sign-out.
  if (!isKitchen && !isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="text-5xl" aria-hidden>🔒</span>
        <h1 className="section-title mt-4">Kitchen staff only</h1>
        <p className="mt-2 text-sm text-soft">
          You&apos;re signed in as <span className="font-semibold text-ink">{user.email ?? user.phoneNumber ?? user.uid}</span> ({user.uid}),
          but this account isn&apos;t on the kitchen staff list. An admin needs to add it under{" "}
          <code className="rounded bg-cream px-1.5 py-0.5 text-xs">/kitchenStaff/&lt;your-uid&gt;</code> in Firestore.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/orders" className="btn btn-ghost px-4 py-2 text-xs">My orders</Link>
          <button onClick={() => { signOut(auth!); router.push("/login"); }} className="btn btn-ghost px-4 py-2 text-xs">
            Sign out & Switch
          </button>
        </div>
      </div>
    );
  }

  // Passed all checks — render the protected content.
  return <>{children}</>;
}
