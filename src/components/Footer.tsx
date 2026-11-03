import Link from "next/link";
import { BUSINESS } from "@/lib/config";
import { waMeLink } from "@/lib/whatsapp";

export function Footer() {
  return (
    <footer className="border-t border-line/70 bg-creamdark/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <p className="font-display text-xl font-semibold">Raku&apos;s Kitchen</p>
          <p className="max-w-xs text-sm text-soft">
            Authentic Nati-style home-cooked food — fresh ingredients, traditional
            taste, hygienic preparation. Lunch & dinner, plus catering for events.
          </p>
          <div className="pt-2 text-xs text-soft border-t border-line/40">
            <p className="font-semibold text-ink">FSSAI Registration</p>
            <p>Lic. No. {BUSINESS.fssaiNumber}</p>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-soft">Menu</p>
          <ul className="space-y-2 text-sm">
            <li><Link className="text-ink hover:text-chilidark" href="/menu">Full Menu</Link></li>
            <li><Link className="text-ink hover:text-chilidark" href="/biryani">Biryani Pricing</Link></li>
            <li><Link className="text-ink hover:text-chilidark" href="/catering">Catering</Link></li>
            <li><Link className="text-ink hover:text-chilidark" href="/orders">Track My Order</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-soft">Visit & order</p>
          <ul className="space-y-2 text-sm text-soft">
            <li>Jambusavari Dinne, JP Nagar 8th Phase, Bangalore</li>
            <li>Lunch ready 12:30 PM · Dinner ready 7:30 PM</li>
            <li>Closed Mondays & Thursdays</li>
            <li>Orders placed one day in advance</li>
            <li><Link className="text-chilidark font-semibold hover:underline" href="/contact">View Location & Map →</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-soft">Talk to us</p>
          <div className="space-y-2 text-sm">
            <a href={`tel:${BUSINESS.phone}`} className="block text-ink hover:text-chilidark">
              {BUSINESS.phoneDisplay}
            </a>
            <a
              href={waMeLink("Hi Raku's Kitchen! I'd like to place an order.")}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-chilidark font-semibold hover:underline"
            >
              WhatsApp us
            </a>
            <a
              href={BUSINESS.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-ink hover:text-chilidark"
            >
              Instagram @{BUSINESS.instagram}
            </a>
          </div>
        </div>
      </div>

      {/* Mandatory Regulatory & Legal Compliance Bar (Cashfree & DPDP required) */}
      <div className="border-t border-line/60 px-4 py-5 max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-soft">
        <p>© {new Date().getFullYear()} Raku&apos;s Kitchen · Pure Taste of Nati Style · Bangalore</p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/terms" className="hover:text-ink hover:underline">
            Terms of Service
          </Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-ink hover:underline">
            Privacy Policy
          </Link>
          <span>·</span>
          <Link href="/refund-policy" className="hover:text-ink hover:underline">
            Refund & Cancellation Policy
          </Link>
          <span>·</span>
          <Link href="/delivery-policy" className="hover:text-ink hover:underline">
            Shipping & Delivery Policy
          </Link>
          <span>·</span>
          <Link href="/contact" className="hover:text-ink hover:underline">
            Contact Us
          </Link>
        </div>
      </div>
    </footer>
  );
}
