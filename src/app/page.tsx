import Link from "next/link";
import Image from "next/image";
import { BUSINESS } from "@/lib/config";
import { waMeLink } from "@/lib/whatsapp";
import { WhatsAppIcon, ClockIcon, MapPinIcon } from "@/components/icons";

const CATEGORY_TILES = [
  { emoji: "🍗", label: "Chicken", note: "biryani · chops · kabab" },
  { emoji: "🥘", label: "Mutton", note: "sambar · fry · chops" },
  { emoji: "🐟", label: "Fish", note: "fry · koli saru" },
  { emoji: "🍚", label: "Rice & Sides", note: "mudde · raita · rasam" },
];

const GALLERY = [
  { src: "/images/dishes/biryani-mutton.webp", label: "Mutton Biryani" },
  { src: "/images/dishes/andhra-chilli-chicken.webp", label: "Chilly Chicken" },
  { src: "/images/dishes/mutton-chops.webp", label: "Mutton Chops" },
  { src: "/images/dishes/fish-fry.webp", label: "Fish Fry" },
  { src: "/images/dishes/kshatriya-kabab.webp", label: "Kshatriya Kabab" },
  { src: "/images/dishes/mutton-sambar.webp", label: "Mutton Sambar" },
];

const PILLARS = [
  {
    emoji: "🌾",
    title: "Fresh ingredients",
    text: "Every order gets its rice and meat weighed and cooked the same day — nothing frozen, nothing held over.",
  },
  {
    emoji: "🔥",
    title: "Authentic taste",
    text: "Proper Nati-style stove-top cooking, the way a home kitchen in JP Nagar would make it.",
  },
  {
    emoji: "🧼",
    title: "Hygienic preparation",
    text: "Clean, careful, home-standard kitchen practices on every single parcel.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,rgba(233,163,25,0.18),transparent),radial-gradient(45rem_25rem_at_10%_110%,rgba(180,55,30,0.12),transparent)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-8 sm:py-20 md:grid-cols-2">
          <div>
            <span className="chip mb-4 border-turmeric/40 bg-turmeric/10 text-turmerick">
              🍲 Pure Taste of Nati Style
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Home-cooked Nati food,{" "}
              <span className="text-chilidark">ordered in one tap.</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-soft">
              Biryani, chops, kababs & nati-style curries — made fresh for lunch and
              dinner in JP Nagar 8th Phase, delivered across Bangalore.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/menu" className="btn btn-chili">
                Order now
              </Link>
              <Link href="/biryani" className="btn btn-turmeric">
                See biryani prices
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-soft">
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-4 w-4 text-chili" /> Lunch {BUSINESS.readyLunch} · Dinner {BUSINESS.readyDinner}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon className="h-4 w-4 text-chili" /> JP Nagar, Bangalore
              </span>
            </div>
          </div>

          {/* Hero plate — the real biryani, straight from the kitchen */}
          <div className="relative mx-auto aspect-square w-full max-w-sm">
            <div
              aria-hidden
              className="absolute inset-8 rounded-full bg-gradient-to-b from-turmeric/60 to-chili/40 blur-2xl"
            />
            <div className="absolute inset-0 overflow-hidden rounded-full shadow-lift ring-4 ring-turmeric/20">
              <Image
                src="/images/dishes/biryani-chicken.webp"
                alt="Nati-style chicken biryani in a brass handi"
                fill
                priority
                sizes="384px"
                className="object-cover"
              />
              <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-cream/50" aria-hidden />
            </div>
            <span className="absolute bottom-6 left-0 -rotate-3 rounded-lg bg-paper px-3 py-1.5 text-xs font-semibold shadow-card">
              ½ kg Chicken Biryani — ₹400
            </span>
            <span className="absolute right-0 top-4 rotate-2 rounded-lg bg-paper px-3 py-1.5 text-xs font-semibold shadow-card">
              Weekdays · Lunch &amp; Dinner
            </span>
          </div>
        </div>
      </section>

      {/* Category tiles */}
      <section className="border-y border-line/60 bg-creamdark/40">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-10 sm:grid-cols-4">
          {CATEGORY_TILES.map((tile) => (
            <Link
              key={tile.label}
              href="/menu"
              className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-card"
            >
              <span className="text-3xl" aria-hidden>{tile.emoji}</span>
              <span>
                <span className="block font-semibold">{tile.label}</span>
                <span className="block text-xs text-soft">{tile.note}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <h2 className="section-title text-center">
          Made like family, <span className="text-chilidark">served like a feast</span>
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="card p-6 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-turmeric/20 text-3xl" aria-hidden>
                {p.emoji}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-soft">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* From the kitchen — real dishes, straight from the pot */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:pb-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title">From the kitchen</h2>
            <p className="mt-1 text-sm text-soft">A few of the dishes people keep ordering.</p>
          </div>
          <Link href="/menu" className="text-sm font-semibold text-chilidark hover:underline">
            Browse full menu →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {GALLERY.map((g) => (
            <Link
              key={g.src}
              href="/menu"
              className="group relative aspect-[4/3] overflow-hidden rounded-2xl shadow-card ring-1 ring-ink/10"
            >
              <Image
                src={g.src}
                alt={g.label}
                fill
                sizes="(min-width: 768px) 33vw, 50vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent"
              />
              <span className="absolute inset-x-0 bottom-0 p-3 text-sm font-semibold text-cream drop-shadow">
                {g.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Catering banner */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="card overflow-hidden bg-gradient-to-br from-chilidark to-chili p-1">
          <div className="flex flex-col items-start justify-between gap-5 px-6 py-8 sm:flex-row sm:items-center sm:px-8">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-bold text-cream sm:text-3xl">
                Hosting a celebration? We cater custom.
              </h2>
              <p className="mt-2 text-cream/85">
                Weddings, birthdays, gatherings — Nati-style food cooked in bulk for
                your event, anywhere in Bangalore.
              </p>
            </div>
            <Link href="/catering" className="btn btn-turmeric shrink-0">
              Plan your event
            </Link>
          </div>
        </div>
      </section>

      {/* Direct order strip */}
      <section className="border-t border-line/60 bg-creamdark/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-soft">Prefer to just message us?</p>
          <a
            href={waMeLink("Hi Raku's Kitchen! I'd like to place an order. 🍲")}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-chili"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Order on WhatsApp · {BUSINESS.phoneDisplay}
          </a>
          <p className="text-xs text-soft">
            Orders placed one day in advance · Closed Mondays &amp; Thursdays · Delivery charges paid by the customer
          </p>
        </div>
      </section>
    </div>
  );
}