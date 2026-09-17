"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";

import {
  BiryaniPotIcon,
  CartIcon,
  CateringIcon,
  HomeIcon,
  MenuBookIcon,
  OrdersReceiptIcon,
  SettingsIcon,
} from "./icons";

export function MobileNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const { setCartOpen, totalUnits } = useCart();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const tabs = [
    { href: "/", label: "Home", Icon: HomeIcon },
    { href: "/menu", label: "Menu", Icon: MenuBookIcon },
    { href: "/biryani", label: "Biryani", Icon: BiryaniPotIcon },
    { href: "/catering", label: "Catering", Icon: CateringIcon },
    { href: "/orders", label: "Orders", Icon: OrdersReceiptIcon },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-paper/95 backdrop-blur md:hidden">
      <div className={isAdmin ? "grid grid-cols-7" : "grid grid-cols-6"}>
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.Icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-1 py-2 text-[11px] font-semibold transition ${
                active ? "text-chilidark" : "text-soft hover:text-ink"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.2]" : "stroke-[1.7]"}`} />
              {tab.label}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className={`flex flex-col items-center gap-1 py-2 text-[11px] font-semibold transition ${
              isActive("/admin") ? "text-greenburn font-bold" : "text-soft hover:text-ink"
            }`}
          >
            <SettingsIcon className={`h-5 w-5 ${isActive("/admin") ? "stroke-[2.2]" : "stroke-[1.7]"}`} />
            Admin
          </Link>
        )}
        <button
          onClick={() => setCartOpen(true)}
          className="relative flex flex-col items-center gap-1 py-2 text-[11px] font-semibold text-soft hover:text-ink"
          aria-label="Open cart"
        >
          <div className="relative">
            <CartIcon className="h-5 w-5 stroke-[1.7]" />
            {totalUnits > 0 && (
              <span className="animate-cart-pop absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-chili px-1 text-[10px] font-bold text-cream">
                {totalUnits}
              </span>
            )}
          </div>
          Cart
        </button>
      </div>
    </nav>
  );
}