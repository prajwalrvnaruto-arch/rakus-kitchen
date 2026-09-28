import { BUSINESS } from "./config";
import { toLocal10 } from "./phone";

/**
 * ShadowFax hyperlocal delivery — server-side client.
 *
 * Mirrors src/lib/borzo.ts: a quote (fare calculator) call plus a create-order
 * call, both falling back to MOCK mode when SHADOWFAX_API_KEY is unset so the
 * admin UI works before partner onboarding is complete.
 *
 * NOTE: ShadowFax's partner API endpoint paths and exact field names vary by
 * onboarding contract. The paths and payload shapes below are placeholders
 * modelled on their public docs and MUST be confirmed against the partner API
 * documentation supplied at onboarding. The response parsing is deliberately
 * defensive (tries several field names) so a minor naming mismatch degrades to
 * a clear error rather than a crash.
 */

const SHADOWFAX_API_BASE =
  process.env.SHADOWFAX_API_BASE || "https://api.shadowfax.in/v3/clients";

/* ── Shared shapes ─────────────────────────────────────────────────────── */

interface ShadowfaxLocation {
  address: string;
  latitude?: number;
  longitude?: number;
  contact_name?: string;
  contact_phone?: string;
}

/** Payload for the fare-quote (calculator) endpoint. */
export interface ShadowfaxQuotePayload {
  pickup_details: ShadowfaxLocation;
  drop_details: ShadowfaxLocation;
}

/** Payload for the create-order endpoint. */
export interface ShadowfaxCreateOrderPayload {
  order_id: string;
  pickup_details: ShadowfaxLocation;
  drop_details: ShadowfaxLocation;
  order_details?: { description?: string };
}

export interface ShadowfaxQuoteResult {
  fareEstimate: number;
  currency: string;
  distanceKm?: number;
  etaMinutes?: number;
  mock?: boolean;
}

export interface ShadowfaxOrderResult {
  carrierId: "shadowfax";
  carrierOrderId: string;
  fareEstimate?: number;
  trackingUrl?: string;
  mock?: boolean;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function apiKey(): string | undefined {
  const k = process.env.SHADOWFAX_API_KEY;
  return k && k.trim() !== "" ? k.trim() : undefined;
}

/** Reads response JSON defensively — a non-JSON body becomes a readable error. */
async function readJson(response: Response, context: string): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `ShadowFax ${context} returned a non-JSON response (HTTP ${response.status}): ${text.slice(0, 200)}`,
    );
  }
}

/** Picks the first defined numeric field from a set of candidate keys. */
function pickNumber(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

/** Picks the first defined non-empty string field from candidate keys. */
function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim() !== "") return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function pickupLocation(): ShadowfaxLocation {
  return {
    address: BUSINESS.kitchenAddress,
    latitude: BUSINESS.lat,
    longitude: BUSINESS.lng,
    contact_name: BUSINESS.name,
    contact_phone: BUSINESS.phone,
  };
}

/* ── Fare calculator (quote) ───────────────────────────────────────────── */

/**
 * Fetches a delivery fare estimate from ShadowFax BEFORE booking, so the admin
 * can see the cost first. Falls back to a mock estimate when no API key is set.
 */
export async function getShadowfaxQuote(params: {
  dropAddress: string;
  dropLat?: number;
  dropLng?: number;
}): Promise<ShadowfaxQuoteResult> {
  const key = apiKey();

  if (!key) {
    // MOCK: rough flat placeholder so the UI renders a number pre-onboarding.
    return { fareEstimate: 45, currency: "INR", distanceKm: undefined, etaMinutes: 30, mock: true };
  }

  const payload: ShadowfaxQuotePayload = {
    pickup_details: pickupLocation(),
    drop_details: {
      address: params.dropAddress,
      latitude: params.dropLat,
      longitude: params.dropLng,
    },
  };

  const response = await fetch(`${SHADOWFAX_API_BASE}/order/quote/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${key}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await readJson(response, "quote");

  if (!response.ok) {
    const msg =
      pickString(data, "message", "error", "detail") || `Quote failed (HTTP ${response.status})`;
    throw new Error(msg);
  }

  const fare = pickNumber(data, "total_amount", "estimated_fare", "amount", "fare");
  if (fare === undefined) {
    throw new Error("ShadowFax quote returned no fare amount — check the response field names.");
  }

  return {
    fareEstimate: fare,
    currency: pickString(data, "currency") || "INR",
    distanceKm: pickNumber(data, "distance", "distance_km"),
    etaMinutes: pickNumber(data, "eta", "eta_minutes", "estimated_time"),
  };
}

/* ── Booking (create order) ────────────────────────────────────────────── */

/**
 * Creates a ShadowFax delivery order. Falls back to MOCK mode (a fake booking)
 * when SHADOWFAX_API_KEY is unset, identical to the Borzo client's behaviour.
 */
export async function createShadowfaxOrder(params: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  dropAddress: string;
  dropLat?: number;
  dropLng?: number;
}): Promise<ShadowfaxOrderResult> {
  const key = apiKey();

  if (!key) {
    const mockId = `SHADOWFAX-${Date.now().toString().slice(-6)}`;
    return {
      carrierId: "shadowfax",
      carrierOrderId: mockId,
      fareEstimate: 45,
      trackingUrl: `https://track.shadowfax.in/#/order/${mockId}`,
      mock: true,
    };
  }

  const payload: ShadowfaxCreateOrderPayload = {
    order_id: params.orderId,
    pickup_details: pickupLocation(),
    drop_details: {
      address: params.dropAddress,
      latitude: params.dropLat,
      longitude: params.dropLng,
      contact_name: params.customerName,
      // Normalize to a bare 10-digit mobile; falls back to the raw string only
      // if it can't be resolved, so a valid number is always cleanly formatted.
      contact_phone: toLocal10(params.customerPhone) || params.customerPhone,
    },
    order_details: { description: `Food Delivery - ${BUSINESS.name} Order #${params.orderId}` },
  };

  const response = await fetch(`${SHADOWFAX_API_BASE}/order/create/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${key}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await readJson(response, "create-order");

  if (!response.ok) {
    const msg =
      pickString(data, "message", "error", "detail") ||
      `ShadowFax API HTTP error ${response.status}`;
    throw new Error(msg);
  }

  const carrierOrderId = pickString(data, "sfx_order_id", "order_id", "id", "awb_number");
  if (!carrierOrderId) {
    throw new Error("ShadowFax booking succeeded but returned no order id — check response fields.");
  }

  return {
    carrierId: "shadowfax",
    carrierOrderId,
    fareEstimate: pickNumber(data, "total_amount", "amount", "fare"),
    trackingUrl: pickString(data, "tracking_url", "track_url"),
  };
}
