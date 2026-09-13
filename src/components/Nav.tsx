"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { CartIcon, LogoMark } from "./icons";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/biryani", label: "Biryani" },
  { href: "/catering", label: "Catering" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Nav() {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();
  const { totalUnits, setCartOpen } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-cream/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            Raku&apos;s Kitchen
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  active ? "bg-chili/10 text-chilidark" : "text-soft hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={`hidden lg:inline-flex rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                pathname.startsWith("/admin")
                  ? "bg-greenburn/10 text-greenburn"
                  : "text-soft hover:text-ink"
              }`}
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCartOpen(true)}
            aria-label="Open cart"
            className="relative rounded-full border border-line bg-paper p-2.5 text-ink transition hover:border-soft"
          >
            <CartIcon className="h-5 w-5" />
            {totalUnits > 0 && (
              <span className="animate-cart-pop absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-chili px-1 text-[11px] font-bold text-cream">
                {totalUnits}
              </span>
            )}
          </button>

          {user ? (
            <Link
              href="/orders"
              className="hidden rounded-full bg-greenburn px-4 py-2 text-sm font-semibold text-cream transition hover:opacity-90 sm:inline-flex"
            >
              My Orders
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-full bg-chili px-4 py-2 text-sm font-semibold text-cream transition hover:bg-chilidark sm:inline-flex"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}