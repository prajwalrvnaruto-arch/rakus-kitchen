import Link from "next/link";
import { MENU_BY_CATEGORY } from "@/lib/menu";
import { DishCard } from "@/components/DishCard";
import { WhatsAppIcon } from "@/components/icons";
import { waMeLink } from "@/lib/whatsapp";

export const metadata = { title: "Menu" };

export default function MenuPage() {
  const categories = Object.keys(MENU_BY_CATEGORY);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <div className="mb-8 text-center">
        <h1 className="section-title">The menu</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-soft">
          Add to cart, pick a meal slot, and we&apos;ll confirm your order on WhatsApp.
          Prices follow the official menu card — dishes sold by weight let you pick
          your portion right on the card.
        </p>
        <Link
          href={waMeLink("Hi Raku's Kitchen! I have a question about the menu.")}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-transparent mt-4 px-4 py-2 text-xs"
        >
          <WhatsAppIcon className="h-4 w-4" /> Ask about a dish
        </Link>
      </div>

      {categories.map((category) => (
        <section key={category} id={category.replace(/\s+/g, "-").toLowerCase()} className="mb-10 scroll-mt-20">
          <div className="mb-4 flex items-end justify-between border-b border-line pb-2">
            <h2 className="font-display text-xl font-semibold sm:text-2xl">{category}</h2>
            {category === "Biryani" && (
              <Link href="/biryani" className="text-sm font-semibold text-chilidark hover:underline">
                Pick by weight →
              </Link>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {MENU_BY_CATEGORY[category].map((item) => (
              <DishCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}