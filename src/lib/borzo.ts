import crypto from "node:crypto";
import { BUSINESS } from "./config";
import { toLocal10, toWaIntl } from "./phone";

export interface BorzoPoint {
  address: string;
  contact_person: {
    name: string;
    phone: string;
  };
  client_order_id?: string;
  note?: string;
}

export interface BorzoCreateOrderPayload {
  type?: string;
  matter: string;
  points: [BorzoPoint, BorzoPoint];
}

export interface BorzoOrderResponse {
  is_successful: boolean;
  order?: {
    order_id: number | string;
    order_name?: string;
    status?: string;
    payment_amount?: string | number;
    delivery_fee_amount?: string | number;
    // Not in Borzo's documented order schema — kept as a defensive fallback
    // in case an account/API version ever returns it at this level.
    tracking_url?: string;
    // Per Borzo's Business API 1.8 docs, the recipient's tracking link lives
    // on the point, not the order: order.points[1].tracking_url (point 0 is
    // pickup, point 1 is drop for our always-2-point orders).
    points?: Array<{ tracking_url?: string }>;
  };
  errors?: string[];
  parameter_errors?: Record<string, string[]>;
}

const BORZO_API_BASE = process.env.BORZO_API_BASE || "https://robot-in.borzodelivery.com/api/business/1.8";

export interface BorzoCalcPoint {
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface BorzoCalculateOrderPayload {
  type?: string;
  matter: string;
  points: [BorzoCalcPoint, BorzoCalcPoint];
}

export interface BorzoCalculateOrderResponse {
  is_successful: boolean;
  order?: {
    payment_amount?: string | number;
    delivery_fee_amount?: string | number;
  };
  errors?: string[];
  parameter_errors?: Record<string, string[]>;
}

/**
 * Creates an automated delivery order via Borzo Business API.
 */
export async function createBorzoOrder(params: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  dropAddress: string;
}): Promise<{
  carrierId: string;
  carrierOrderId: string;
  fareEstimate?: number;
  trackingUrl?: string;
  mock?: boolean;
}> {
  const apiKey = process.env.BORZO_API_KEY;

  // Fallback to MOCK mode if BORZO_API_KEY is not configured yet
  if (!apiKey || apiKey.trim() === "") {
    const mockId = `BORZO-${Date.now().toString().slice(-6)}`;
    return {
      carrierId: "borzo",
      carrierOrderId: mockId,
      fareEstimate: 65,
      trackingUrl: `https://borzodelivery.com/in/tracking?id=${mockId}`,
      mock: true,
    };
  }

  const payload: BorzoCreateOrderPayload = {
    type: "standard",
    matter: `Food Delivery - ${BUSINESS.name} Order #${params.orderId}`,
    points: [
      {
        address: BUSINESS.kitchenAddress,
        contact_person: {
          name: BUSINESS.name,
          // Borzo's Business API docs show phone as country code + 10 digits
          // (e.g. "918880000001"), not a bare 10-digit local number.
          phone: toWaIntl(BUSINESS.phone) || BUSINESS.phone,
        },
        note: "Food order ready for pickup",
      },
      {
        address: params.dropAddress,
        contact_person: {
          name: params.customerName,
          // Same international format; falls back to the raw string only if
          // it can't be resolved to a valid Indian mobile at all.
          phone: toWaIntl(params.customerPhone) || params.customerPhone,
        },
        client_order_id: params.orderId,
      },
    ],
  };

  const response = await fetch(`${BORZO_API_BASE}/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-DV-Auth-Token": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as BorzoOrderResponse;

  if (!response.ok || !data.is_successful || !data.order) {
    const errorMsg = formatBorzoErrorResponse(data, response.status);
    throw new Error(errorMsg);
  }

  const fare = data.order.delivery_fee_amount
    ? parseFloat(String(data.order.delivery_fee_amount))
    : undefined;

  return {
    carrierId: "borzo",
    carrierOrderId: String(data.order.order_id || data.order.order_name),
    fareEstimate: fare,
    // Borzo returns the recipient's tracking link per-point (points[1] is the
    // drop point), not on the order itself — order.tracking_url is checked
    // first only as a defensive fallback.
    trackingUrl: data.order.tracking_url || data.order.points?.[1]?.tracking_url,
  };
}

/**
 * Estimates the delivery fee for a kitchen → drop-point route via Borzo's
 * calculate-order endpoint, without creating a real order. Sending lat/long
 * alongside the address (not just the address string) avoids Borzo falling
 * back to its own, less precise, geocoding of the text.
 */
export async function calculateBorzoDeliveryFee(params: {
  dropAddress: string;
  dropLat: number;
  dropLng: number;
}): Promise<{ deliveryFee: number; mock?: boolean }> {
  const apiKey = process.env.BORZO_API_KEY;

  // Fallback to MOCK mode if BORZO_API_KEY is not configured yet — mirrors
  // createBorzoOrder's convention so checkout keeps working in dev.
  if (!apiKey || apiKey.trim() === "") {
    return { deliveryFee: 65, mock: true };
  }

  const payload: BorzoCalculateOrderPayload = {
    type: "standard",
    matter: `Food Delivery - ${BUSINESS.name} Order Estimate`,
    points: [
      {
        address: BUSINESS.kitchenAddress,
        latitude: BUSINESS.lat,
        longitude: BUSINESS.lng,
      },
      {
        address: params.dropAddress,
        latitude: params.dropLat,
        longitude: params.dropLng,
      },
    ],
  };

  const response = await fetch(`${BORZO_API_BASE}/calculate-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-DV-Auth-Token": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as BorzoCalculateOrderResponse;

  if (!response.ok || !data.is_successful || !data.order) {
    const errorMsg = formatBorzoErrorResponse(data as BorzoOrderResponse, response.status);
    throw new Error(errorMsg);
  }

  const fee = data.order.delivery_fee_amount
    ? parseFloat(String(data.order.delivery_fee_amount))
    : NaN;

  if (Number.isNaN(fee)) {
    throw new Error("Borzo did not return a delivery fee for this route");
  }

  return { deliveryFee: fee };
}

export interface BorzoCancelOrderResponse {
  is_successful: boolean;
  order?: {
    order_id: number | string;
    status?: string;
    status_description?: string;
  };
  errors?: string[];
  parameter_errors?: Record<string, string[]>;
}

/**
 * Cancels a previously booked Borzo order. Per Borzo's Business API 1.8 docs,
 * only orders in status new/available/active/delayed can be cancelled — once
 * a courier has visited any address, the call fails and the caller should
 * tell the admin to coordinate with the courier directly instead.
 */
export async function cancelBorzoOrder(params: {
  carrierOrderId: string;
}): Promise<{ status?: string; mock?: boolean }> {
  const apiKey = process.env.BORZO_API_KEY;
  const orderId = Number(params.carrierOrderId);

  // Mock bookings (created when BORZO_API_KEY is unset) have no real Borzo
  // order to cancel — mirror createBorzoOrder's mock convention so cancel
  // still "succeeds" locally in dev.
  if (!apiKey || apiKey.trim() === "" || Number.isNaN(orderId)) {
    return { status: "canceled", mock: true };
  }

  const response = await fetch(`${BORZO_API_BASE}/cancel-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-DV-Auth-Token": apiKey,
    },
    body: JSON.stringify({ order_id: orderId }),
  });

  const data = (await response.json()) as BorzoCancelOrderResponse;

  if (!response.ok || !data.is_successful || !data.order) {
    const errorMsg = formatBorzoErrorResponse(data as BorzoOrderResponse, response.status);
    throw new Error(errorMsg);
  }

  return { status: data.order.status };
}

/**
 * Verifies a Borzo webhook's X-DV-Signature header: HMAC-SHA256 of the RAW
 * request body, keyed with the Callback Secret Key from Borzo's Personal
 * cabinet (BORZO_WEBHOOK_SECRET — distinct from BORZO_API_KEY). Unlike
 * Meta's X-Hub-Signature-256, Borzo's header is a bare hex digest with no
 * "sha256=" prefix (per their PHP example: hash_hmac(...) compared directly).
 */
export function verifyBorzoWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.BORZO_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signatureHeader, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Formats Borzo's response errors and nested parameter_errors into human-readable messages.
 */
export function formatBorzoErrorResponse(data: BorzoOrderResponse, status: number): string {
  if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.filter(Boolean).join("; ");
  }

  if (data.parameter_errors && typeof data.parameter_errors === "object") {
    const pieces: string[] = [];
    const walk = (val: unknown, keyPath: string) => {
      if (typeof val === "string") {
        const label = cleanParamKey(keyPath);
        pieces.push(label ? `${label}: ${val}` : val);
      } else if (Array.isArray(val)) {
        val.forEach((item) => walk(item, keyPath));
      } else if (val && typeof val === "object") {
        for (const [k, v] of Object.entries(val)) {
          walk(v, keyPath ? `${keyPath}.${k}` : k);
        }
      }
    };
    walk(data.parameter_errors, "");
    if (pieces.length > 0) {
      return pieces.join(" • ");
    }
  }

  return `Borzo API returned error status ${status}`;
}

function cleanParamKey(key: string): string {
  if (key.includes("phone")) return "Customer Phone";
  if (key.includes("address")) return "Delivery Address";
  if (key.includes("matter")) return "Order Details";
  return key;
}
