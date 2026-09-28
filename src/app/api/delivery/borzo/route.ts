import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { createBorzoOrder } from "@/lib/borzo";

export async function POST(request: Request) {
  // Only a signed-in admin may book a delivery — same guard as the Shadowfax
  // routes. Without this, any caller could trigger a (billable) Borzo booking.
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as {
      orderId?: string;
      customerName?: string;
      customerPhone?: string;
      dropAddress?: string;
    };

    if (!body.orderId || !body.customerName || !body.customerPhone || !body.dropAddress) {
      return NextResponse.json(
        { error: "Missing required order parameters for Borzo delivery" },
        { status: 400 },
      );
    }

    const result = await createBorzoOrder({
      orderId: body.orderId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      dropAddress: body.dropAddress,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Borzo delivery booking error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to book Borzo delivery" },
      { status: 500 },
    );
  }
}
