import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/requireUser";
import { checkMapsRateLimit, clientIp } from "@/lib/server/mapsRateLimit";
import { isWithinServiceArea, OUT_OF_SERVICE_AREA_MESSAGE } from "@/lib/geofence";
import { calculateBorzoDeliveryFee } from "@/lib/borzo";

/**
 * Customer-facing delivery-fee estimate, called once the checkout address is
 * confirmed. Unlike /api/delivery/borzo (admin-only, books a real delivery),
 * this must be reachable by any signed-in customer mid-checkout — so it's
 * gated by requireUser (not requireAdmin) plus the same per-user+IP throttle
 * used for the Ola Maps proxy routes, since calculate-order calls still count
 * against Borzo's rate limit.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const limited = checkMapsRateLimit(`bz-est:${auth.uid}:${clientIp(request)}`);
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      dropAddress?: string;
      lat?: number;
      lng?: number;
      pincode?: string;
      state?: string;
    };

    if (!body.dropAddress?.trim() || typeof body.lat !== "number" || typeof body.lng !== "number") {
      return NextResponse.json({ error: "Missing delivery address or coordinates" }, { status: 400 });
    }

    if (!isWithinServiceArea(body.lat, body.lng, { pincode: body.pincode, state: body.state })) {
      return NextResponse.json({ error: OUT_OF_SERVICE_AREA_MESSAGE }, { status: 400 });
    }

    const result = await calculateBorzoDeliveryFee({
      dropAddress: body.dropAddress,
      dropLat: body.lat,
      dropLng: body.lng,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Borzo delivery estimate error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to estimate delivery fee" },
      { status: 500 },
    );
  }
}
