import { NextResponse } from "next/server";
import { requireKitchen } from "@/lib/server/requireKitchen";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { buildSlotSummaries } from "@/lib/kitchenPrep";
import type { OrderLineItem } from "@/types";

// Always run fresh — the prep sheet must reflect the current day's orders, not
// a cached response. (Route handlers are dynamic by default once they read the
// request, but be explicit so a future refactor can't make this static.)
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Kitchen prep sheet for one day. Kitchen staff (and admins) only — guarded by
 * requireKitchen. Reads orders with the Admin SDK server-side and returns ONLY
 * aggregated prep rows per slot. Customer names, phones, addresses, payment and
 * order totals never leave the server, so staff cannot see PII even though the
 * underlying order documents contain it.
 *
 *   GET /api/kitchen/prep?date=YYYY-MM-DD  →  { lunch, dinner }
 */
export async function GET(request: Request) {
  const auth = await requireKitchen(request);
  if (auth instanceof NextResponse) return auth;

  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Missing or invalid date (expected YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const snap = await adminDb().collection("orders").where("mealDate", "==", date).get();
    // Pull only the fields the prep sheet needs — this is the single point where
    // we decide what leaves the server, so PII simply isn't read into the result.
    const orders = snap.docs.map((d) => {
      const data = d.data();
      return {
        mealSlot: data.mealSlot as string | undefined,
        status: data.status as string | undefined,
        items: (data.items ?? []) as OrderLineItem[],
      };
    });
    return NextResponse.json(buildSlotSummaries(orders));
  } catch (err) {
    console.error("Kitchen prep aggregation error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Could not load prep sheet" },
      { status: 500 },
    );
  }
}
