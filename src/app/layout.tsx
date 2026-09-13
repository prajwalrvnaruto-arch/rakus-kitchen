import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { Nav } from "@/components/Nav";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Raku's Kitchen — Pure Taste of Nati Style",
    template: "%s · Raku's Kitchen",
  },
  description:
    "Authentic Nati-style home-cooked food from Raku's Kitchen, JP Nagar 8th Phase, Bangalore. Biryani, chicken, mutton, fish & catering. Order online for lunch & dinner.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <AuthProvider>
          <CartProvider>
            <Nav />
            <main className="flex-1 pb-20 md:pb-0">{children}</main>
            <Footer />
            <CartDrawer />
            <MobileNav />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}