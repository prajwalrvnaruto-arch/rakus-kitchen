import { NextResponse } from "next/server";
import { createBorzoOrder } from "@/lib/borzo";

export async function POST(request: Request) {
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
