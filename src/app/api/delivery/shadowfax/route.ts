import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { createShadowfaxOrder } from "@/lib/shadowfax";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as {
      orderId?: string;
      customerName?: string;
      customerPhone?: string;
      dropAddress?: string;
      dropLat?: number;
      dropLng?: number;
    };

    if (!body.orderId || !body.customerName || !body.customerPhone || !body.dropAddress) {
      return NextResponse.json(
        { error: "Missing required order parameters for ShadowFax delivery" },
        { status: 400 },
      );
    }

    const result = await createShadowfaxOrder({
      orderId: body.orderId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      dropAddress: body.dropAddress,
      dropLat: body.dropLat,
      dropLng: body.dropLng,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("ShadowFax delivery booking error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to book ShadowFax delivery" },
      { status: 500 },
    );
  }
}
