import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getShadowfaxQuote } from "@/lib/shadowfax";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as {
      dropAddress?: string;
      dropLat?: number;
      dropLng?: number;
    };

    if (!body.dropAddress) {
      return NextResponse.json(
        { error: "Missing dropAddress for ShadowFax fare quote" },
        { status: 400 },
      );
    }

    const result = await getShadowfaxQuote({
      dropAddress: body.dropAddress,
      dropLat: body.dropLat,
      dropLng: body.dropLng,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("ShadowFax fare quote error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to fetch ShadowFax fare quote" },
      { status: 500 },
    );
  }
}
