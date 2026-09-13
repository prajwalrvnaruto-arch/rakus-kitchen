import Link from "next/link";

export const metadata = { title: "About" };

const STORY = [
  {
    emoji: "🏠",
    title: "It starts at home",
    text: "Raku's Kitchen began in a home kitchen in JP Nagar 8th Phase — the same pot-and-flame way our family always ate, and the way we still cook every order today.",
  },
  {
    emoji: "🍗",
    title: "Nati-style, not hotel-style",
    text: "'Nati' means the food comes from old homes — slow-cooked, boldly spiced, weighed generously. No shortcuts, no pre-made mixes, no frozen stock.",
  },
  {
    emoji: "⚖️",
    title: "Weighed in front of you",
    text: "Rice and meat are measured before cooking, so what you order by weight is what actually goes into the parcel.",
  },
  {
    emoji: "🧑‍🍳",
    title: "A one-day promise",
    text: "Orders are placed one day ahead, food is made to order at 12:30 PM for lunch and 7:30 PM for dinner, then handed to the delivery partner fresh.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="text-center">
        <span className="chip mb-4 border-turmeric/40 bg-turmeric/10 text-turmerick">🏡 Our story</span>
        <h1 className="section-title">Pure taste, home-made</h1>
        <p className="mt-3 text-soft">
          Raku&apos;s Kitchen serves authentic Nati-style non-vegetarian food across
          Bangalore — lunch, dinner, and full catering for your events.
        </p>
      </div>

      <div className="mt-10 space-y-4">
        {STORY.map((block, i) => (
          <div key={block.title} className="card flex items-start gap-4 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-turmeric/20 text-2xl" aria-hidden>
              {block.emoji}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-turmerick">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h2 className="font-display text-lg font-semibold">{block.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-soft">{block.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-turmeric/40 bg-turmeric/10 p-6 text-center">
        <p className="font-display text-xl font-semibold">Come hungry.</p>
        <p className="mt-1 text-sm text-soft">Your next Nati meal is one tap away.</p>
        <Link href="/menu" className="btn btn-chili mt-4">
          Order now
        </Link>
      </div>
    </div>
  );
}