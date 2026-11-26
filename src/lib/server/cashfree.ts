import "server-only";
import { Cashfree, CFEnvironment } from "cashfree-pg";

/**
 * Cashfree Payments integration — server-only.
 * CASHFREE_SECRET_KEY must never reach the browser.
 * CASHFREE_APP_ID is also server-only (unlike Razorpay's public key,
 * Cashfree's checkout is initiated via payment_session_id — no client key needed).
 *
 * API version: 2023-08-01
 */

/** "production" only when CASHFREE_ENV=production; anything else is sandbox,
 *  so test keys can never hit the live endpoint by accident. */
export function cashfreeMode(): "sandbox" | "production" {
  return process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
}

function getClient(): Cashfree {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  if (!appId || !secretKey) {
    throw new Error(
      "Cashfree not configured — set CASHFREE_APP_ID and CASHFREE_SECRET_KEY."
    );
  }
  return new Cashfree(
    cashfreeMode() === "production" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
    appId,
    secretKey,
  );
}

export interface CashfreeOrder {
  /** Cashfree's internal order ID (cf_order_id) */
  cfOrderId: string;
  /** Your merchant order ID */
  orderId: string;
  /** Session token passed to the browser to initiate payment */
  paymentSessionId: string;
  /** Amount in rupees (not paise) */
  amount: number;
  currency: string;
}

/** How long a customer has to complete payment after create-order. */
export const ORDER_EXPIRY_MINUTES = 30;

export async function createCashfreeOrder(params: {
  orderId: string;
  amountRupees: number;
  customerId: string;
  customerPhone: string;
  customerName?: string;
  /** Absolute URL — Cashfree appends ?order_id={order_id} on redirect */
  returnUrl: string;
  note?: string;
}): Promise<CashfreeOrder> {
  const cf = getClient();
  const res = await cf.PGCreateOrder({
    order_id: params.orderId,
    order_amount: params.amountRupees,
    order_currency: "INR",
    order_note: params.note,
    // Short payment window, so an old popup can't be paid for a meal slot
    // that has already passed.
    order_expiry_time: new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60_000).toISOString(),
    customer_details: {
      customer_id: params.customerId,
      customer_phone: params.customerPhone,
      customer_name: params.customerName,
    },
    order_meta: {
      return_url: `${params.returnUrl}?order_id={order_id}`,
      notify_url: undefined, // Cashfree webhook URL is configured in the dashboard
    },
  });

  const data = res.data;
  if (!data || !data.payment_session_id || !data.order_id) {
    throw new Error("Cashfree order creation returned an unexpected response.");
  }

  return {
    cfOrderId: String(data.cf_order_id ?? data.order_id),
    orderId: data.order_id,
    paymentSessionId: data.payment_session_id,
    amount: data.order_amount ?? params.amountRupees,
    currency: data.order_currency ?? "INR",
  };
}

export type CashfreeOrderStatus = "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED";

export interface CashfreePaymentDetails {
  orderId: string;
  orderStatus: CashfreeOrderStatus;
  /** Amount in rupees */
  paidAmount?: number;
  cfPaymentId?: string;
  paymentStatus?: string;
}

/** Fetches order status from Cashfree — used as the verification step after
 *  the customer is redirected back from the payment page. */
export async function fetchCashfreeOrder(
  orderId: string
): Promise<CashfreePaymentDetails> {
  const cf = getClient();
  const res = await cf.PGFetchOrder(orderId);

  const data = res.data;
  if (!data) {
    throw new Error(`Cashfree returned no data for order ${orderId}`);
  }

  return {
    orderId: data.order_id ?? orderId,
    orderStatus: (data.order_status as CashfreeOrderStatus) ?? "ACTIVE",
    paidAmount: data.order_amount,
  };
}

/** Fetches payments for an order — used for the webhook backstop to get
 *  the cf_payment_id after a PAYMENT_SUCCESS_WEBHOOK event. */
export async function fetchCashfreePayments(orderId: string): Promise<
  Array<{ cfPaymentId: string; paymentStatus: string; paymentAmount: number }>
> {
  const cf = getClient();
  const res = await cf.PGOrderFetchPayments(orderId);
  const payments = res.data;
  if (!Array.isArray(payments)) return [];
  return payments.map((p) => ({
    cfPaymentId: String(p.cf_payment_id ?? ""),
    paymentStatus: p.payment_status ?? "",
    paymentAmount: p.payment_amount ?? 0,
  }));
}

/** Verifies a Cashfree webhook signature. Throws if verification fails. */
export function verifyCashfreeWebhook(
  signature: string | null,
  rawBody: string,
  timestamp: string | null
): CashfreeWebhookEvent {
  if (!signature || !timestamp) {
    throw new Error("Missing Cashfree webhook signature or timestamp header.");
  }
  // PGVerifyWebhookSignature throws on invalid signature; returns the parsed event on success
  const event = getClient().PGVerifyWebhookSignature(signature, rawBody, timestamp);
  return event as CashfreeWebhookEvent;
}

export interface CashfreeWebhookEvent {
  type: string;
  raw: string;
  object?: CashfreeWebhookPayload;
}

export interface CashfreeWebhookPayload {
  data?: {
    order?: {
      order_id: string;
      order_amount: number;
      order_currency: string;
    };
    payment?: {
      cf_payment_id: string;
      payment_status: "SUCCESS" | "FAILED" | "PENDING" | string;
      payment_amount: number;
      payment_currency: string;
      payment_message?: string;
    };
  };
}
