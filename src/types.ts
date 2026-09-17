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

/** A pickable size/weight for a dish, e.g. { label: "½ kg", price: 400 }. */
export interface MenuVariant {
  label: string;
  price: number;
}

export interface MenuItem {
  id: string;
  category: string;
  name: string;
  emoji: string;
  /** Public path to a real food photo (e.g. "/images/dishes/fish-fry.webp").
   *  Falls back to the emoji tile when absent. */
  photo?: string;
  description: string;
  /** Price in rupees for the default unit. When `variants` is set, the dish is
   *  priced per variant and `price` is ignored at add time (leave it unset). */
  price?: number;
  /** Pickable portion weights (e.g. ½ kg / 1 kg). The DishCard renders a
   *  selector and adds the chosen variant to the cart. */
  variants?: MenuVariant[];
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

/**
 * Geo-coded, structured delivery address.
 * Stored on new orders alongside the legacy plain-string `deliveryAddress`
 * so old orders still render gracefully.
 */
export interface AddressComponents {
  lat: number;
  lng: number;
  /** Google Places place_id — enables linking back to the exact POI. */
  googlePlaceId?: string;
  /** Full verified address string sourced from Google Places / Geocoding API. */
  displayAddress: string;
  /** Customer-entered details: e.g. "Flat 4B, 3rd Floor, Prestige Tower". */
  doorAndBuilding: string;
  /** Optional landmark for driver navigation, e.g. "Opposite Metro Station". */
  landmark?: string;
  city: string;
  pincode: string;
}

/**
 * Third-party delivery carrier booking metadata.
 * Written to the order document when the admin clicks "Book Delivery".
 */
export interface DeliveryMeta {
  /** Fare estimate in ₹ fetched from the carrier API at checkout time. */
  fareEstimate?: number;
  /** Carrier identifier: "porter" | "borzo". */
  carrierId?: string;
  /** Order ID returned by the carrier after a successful booking. */
  carrierOrderId?: string;
  /** Epoch ms when the admin triggered the carrier booking. */
  bookedAt?: number;
  /** Live tracking URL provided by the carrier, if available. */
  trackingUrl?: string;
}

export interface Order {
  id: string; // Firestore doc id
  orderId: string; // human-friendly RK-00001
  customerId: string;
  customerName: string;
  phone: string;
  /** Legacy plain-text address — preserved for backward compat. */
  deliveryAddress: string;
  /** Structured geo-coded address — present on all orders placed after this feature ships. */
  addressComponents?: AddressComponents;
  /** Carrier booking metadata — populated when the admin books a delivery ride. */
  deliveryMeta?: DeliveryMeta;
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