"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";

const TABS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/menu", label: "Menu", icon: "🥘" },
  { href: "/biryani", label: "Biryani", icon: "🍗" },
  { href: "/catering", label: "Catering", icon: "🎉" },
  { href: "/orders", label: "Orders", icon: "🧾" },
];

export function MobileNav() {
  const pathname = usePathname();
  const { setCartOpen, totalUnits } = useCart();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-paper/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-6">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                active ? "text-chilidark" : "text-soft"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          );
        })}
        <button
          onClick={() => setCartOpen(true)}
          className="relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-soft"
          aria-label="Open cart"
        >
          <span className="relative text-lg leading-none" aria-hidden>
            🛒
            {totalUnits > 0 && (
              <span className="animate-cart-pop absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-chili px-1 text-[10px] font-bold text-cream">
                {totalUnits}
              </span>
            )}
          </span>
          Cart
        </button>
      </div>
    </nav>
  );
}