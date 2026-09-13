export type OrderStatus =
  | "Order Received"
  | "Confirmed"
  | "Preparing"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "Order Received",
  "Confirmed",
  "Preparing",
  "Out for Delivery",
  "Delivered",
];

export const ORDER_STATUS_FLOW: Record<OrderStatus, number> = {
  "Order Received": 0,
  Confirmed: 1,
  Preparing: 2,
  "Out for Delivery": 3,
  Delivered: 4,
  Cancelled: -1,
};

export type MealSlot = "Lunch" | "Dinner";

export type BiryaniMeat = "chicken" | "mutton";
export type BiryaniWeight = 0.5 | 1 | 2 | 3;

export interface MenuItem {
  id: string;
  category: string;
  name: string;
  emoji: string;
  /** Public path to a real food photo (e.g. "/images/dishes/fish-fry.webp").
   *  Falls back to the emoji tile when absent. */
  photo?: string;
  description: string;
  /** Price in rupees. null means "ask the business" — not addable to cart. */
  price: number;
  /** True when the price is a placeholder awaiting business confirmation. */
  placeholder?: boolean;
  unit?: string; // e.g. "per plate", "per pcs"
  veg?: boolean;
}

/** A single line in the customer's cart. */
export interface CartItem {
  menuId: string;
  name: string;
  emoji: string;
  /** Unit price for quantity 1. */
  price: number;
  quantity: number;
  /** Label for the variant (e.g. "½ kg · Chicken"). */
  variant?: string;
}

export interface OrderLineItem {
  menuId: string;
  name: string;
  variant?: string;
  qty: number;
  pricePerUnit: number;
  lineTotal: number;
}

export interface StatusEvent {
  status: OrderStatus;
  at: number; // epoch ms
}

export interface Order {
  id: string; // Firestore doc id
  orderId: string; // human-friendly RK-00001
  customerId: string;
  customerName: string;
  phone: string;
  deliveryAddress: string;
  mealSlot: MealSlot;
  mealDate: string; // YYYY-MM-DD
  items: OrderLineItem[];
  itemTotal: number;
  packagingFee: number;
  grandTotal: number;
  status: OrderStatus;
  statusHistory: StatusEvent[];
  notes?: string;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}