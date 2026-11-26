import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/server/firebaseAdmin";
import { getOrderById } from "@/lib/server/dbUtils";
import { generateInvoicePDF } from "@/lib/server/invoiceGenerator";

export const runtime = "nodejs";

/**
 * GET /api/orders/[orderId]/invoice
 *
 * Generate and download invoice PDF for an order.
 * Customer can only access their own orders.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const { uid } = await verifyIdToken(authHeader);

    const { orderId } = await context.params;

    // Fetch order and verify ownership
    const order = await getOrderById(orderId);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.customerId !== uid) {
      return NextResponse.json(
        { error: "You can only access your own invoices" },
        { status: 403 }
      );
    }

    // Generate PDF
    const pdfBuffer = generateInvoicePDF(order);

    // Return as downloadable file
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice-${order.orderId}.pdf"`,
        "Cache-Control": "private, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (err) {
    console.error("Invoice generation error:", err);

    if ((err as Error).message?.includes("token")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate invoice" },
      { status: 500 }
    );
  }
}
