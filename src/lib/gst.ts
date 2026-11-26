/**
 * GST calculation utilities for Raku's Kitchen.
 *
 * All displayed prices are GST-inclusive at 5% rate.
 * This utility provides reverse calculation to show GST breakdown on invoices.
 */

export const GST_RATE = 5; // 5% for restaurant services

export interface GSTBreakdown {
  itemTotalBeforeGST: number;
  packagingFeeBeforeGST: number;
  subtotalBeforeGST: number;
  gstAmount: number;
  gstRate: number;
}

/**
 * Reverse-calculate GST breakdown from GST-inclusive totals.
 * Used for invoice generation when order doesn't have stored GST breakdown.
 */
export function calculateGSTBreakdown(
  itemTotal: number,
  packagingFee: number
): GSTBreakdown {
  const divisor = 1 + GST_RATE / 100;

  const itemTotalBeforeGST = itemTotal / divisor;
  const packagingFeeBeforeGST = packagingFee / divisor;
  const subtotalBeforeGST = itemTotalBeforeGST + packagingFeeBeforeGST;
  const gstAmount = (itemTotal + packagingFee) - subtotalBeforeGST;

  return {
    itemTotalBeforeGST: Math.round(itemTotalBeforeGST * 100) / 100,
    packagingFeeBeforeGST: Math.round(packagingFeeBeforeGST * 100) / 100,
    subtotalBeforeGST: Math.round(subtotalBeforeGST * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    gstRate: GST_RATE,
  };
}

/**
 * Get GST breakdown for an order, using stored value or calculating on-demand.
 */
export function getOrderGSTBreakdown(order: {
  itemTotal: number;
  packagingFee: number;
  gstBreakdown?: GSTBreakdown;
}): GSTBreakdown {
  return order.gstBreakdown ?? calculateGSTBreakdown(order.itemTotal, order.packagingFee);
}
