import { BIRYANI_PRICING, BIRYANI_RATIO, formatINR } from "@/lib/menu";
import { BiryaniPicker } from "@/components/BiryaniPicker";
import type { BiryaniWeight } from "@/types";

export const metadata = { title: "Biryani" };

const WEIGHTS: BiryaniWeight[] = [0.5, 1, 2, 3];
const weightLabel = (w: BiryaniWeight) => (w === 0.5 ? "½ kg" : `${w} kg`);

export default function BiryaniPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <div className="mb-8 text-center">
        <h1 className="section-title">Biryani, weighed to order</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-soft">
          Chicken or mutton, in the exact quantity your family will eat. Rice and
          meat are weighed before it hits the pot — the ratio is printed on the box.
        </p>
      </div>

      <BiryaniPicker />

      {/* Price table */}
      <section className="mt-12">
        <h2 className="section-title mb-4 text-lg">Price chart (per quantity)</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[20rem] text-sm">
            <thead>
              <tr className="border-b border-line bg-cream text-left text-xs font-bold uppercase tracking-wider text-soft">
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Chicken Biryani</th>
                <th className="px-4 py-3">Mutton Biryani</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {WEIGHTS.map((w) => (
                <tr key={w}>
                  <td className="px-4 py-3 font-semibold">{weightLabel(w)}</td>
                  <td className="px-4 py-3">{formatINR(BIRYANI_PRICING[w].chicken)}</td>
                  <td className="px-4 py-3">{formatINR(BIRYANI_PRICING[w].mutton)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-soft">
          Prices at ½ kg &amp; 1 kg are fixed by the kitchen; 2 kg &amp; 3 kg extend
          at the per-kg rate. A ₹20 packaging fee per item applies.
        </p>
      </section>

      {/* Ratio table */}
      <section className="mt-10">
        <h2 className="section-title mb-4 text-lg">What goes into your biryani</h2>
        <div className="card divide-y divide-line/60">
          {WEIGHTS.map((w) => (
            <div key={w} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="font-semibold">{weightLabel(w)} biryani</span>
              <span className="text-soft">
                {BIRYANI_RATIO[w].rice} uncooked rice · <span className="font-semibold text-ink">{BIRYANI_RATIO[w].meat}</span> chicken/mutton
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}