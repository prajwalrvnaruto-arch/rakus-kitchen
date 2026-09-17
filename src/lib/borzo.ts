import { BUSINESS } from "./config";

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
    tracking_url?: string;
  };
  errors?: string[];
  parameter_errors?: Record<string, string[]>;
}

const BORZO_API_BASE = process.env.BORZO_API_BASE || "https://robot-in.borzodelivery.com/api/business/1.8";

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
          phone: BUSINESS.phone,
        },
        note: "Food order ready for pickup",
      },
      {
        address: params.dropAddress,
        contact_person: {
          name: params.customerName,
          phone: params.customerPhone,
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
    const errorMsg =
      data.errors?.join(", ") ||
      (data.parameter_errors ? JSON.stringify(data.parameter_errors) : `Borzo API HTTP error ${response.status}`);
    throw new Error(errorMsg);
  }

  const fare = data.order.delivery_fee_amount
    ? parseFloat(String(data.order.delivery_fee_amount))
    : undefined;

  return {
    carrierId: "borzo",
    carrierOrderId: String(data.order.order_id || data.order.order_name),
    fareEstimate: fare,
    trackingUrl: data.order.tracking_url,
  };
}
