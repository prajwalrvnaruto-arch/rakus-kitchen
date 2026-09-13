import { BUSINESS } from "@/lib/config";
import { waMeLink } from "@/lib/whatsapp";
import { WhatsAppIcon, PhoneIcon, MapPinIcon, ClockIcon } from "@/components/icons";

const INFO_CARDS = [
  {
    icon: <MapPinIcon className="h-5 w-5 text-chili" />,
    title: "Pickup location",
    lines: ["Jambusavari Dinne,", "JP Nagar 8th Phase, Bangalore"],
  },
  {
    icon: <ClockIcon className="h-5 w-5 text-chili" />,
    title: "When we cook",
    lines: ["Lunch ready 12:30 PM", "Dinner ready 7:30 PM", "Closed Mon & Thu"],
  },
  {
    icon: <PhoneIcon className="h-5 w-5 text-chili" />,
    title: "Order contact",
    lines: [BUSINESS.phoneDisplay, "Orders placed one day ahead"],
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <div className="text-center">
        <h1 className="section-title">Find us & order</h1>
        <p className="mt-2 text-sm text-soft">
          Pickup from JP Nagar 8th Phase, or delivery across Bangalore — the
          delivery charge is paid to the partner at your door.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {INFO_CARDS.map((card) => (
          <div key={card.title} className="card p-5 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-chili/10" aria-hidden>
              {card.icon}
            </span>
            <h2 className="mt-3 font-display font-semibold">{card.title}</h2>
            <div className="mt-1 space-y-0.5 text-sm text-soft">
              {card.lines.map((line) => <p key={line}>{line}</p>)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <a
          href={waMeLink("Hi Raku's Kitchen! I'd like to place an order. 🍲")}
          target="_blank"
          rel="noopener noreferrer"
          className="card flex items-center justify-between p-6 transition hover:shadow-card"
        >
          <span>
            <span className="block font-display text-lg font-semibold">WhatsApp an order</span>
            <span className="text-sm text-soft">{BUSINESS.phoneDisplay} · replies fast</span>
          </span>
          <WhatsAppIcon className="h-8 w-8 text-ok" />
        </a>
        <a
          href={`tel:${BUSINESS.phone}`}
          className="card flex items-center justify-between p-6 transition hover:shadow-card"
        >
          <span>
            <span className="block font-display text-lg font-semibold">Call for catering</span>
            <span className="text-sm text-soft">{BUSINESS.phoneDisplay} · events & bulk</span>
          </span>
          <PhoneIcon className="h-8 w-8 text-chili" />
        </a>
        <a
          href={BUSINESS.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="card sm:col-span-2 flex items-center justify-between p-6 transition hover:shadow-card"
        >
          <span>
            <span className="block font-display text-lg font-semibold">Follow the food</span>
            <span className="text-sm text-soft">@rakus.kitchen — daily specials & new dishes</span>
          </span>
          <span className="text-3xl" aria-hidden>📸</span>
        </a>
      </div>
    </div>
  );
}