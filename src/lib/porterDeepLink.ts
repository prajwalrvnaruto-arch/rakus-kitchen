import { BUSINESS } from "./config";
import type { Order } from "@/types";

export interface PorterLocationData {
  name: string;
  phone: string;
  lat: number;
  lng: number;
  addressString: string;
}

export interface PorterBookingPayload {
  pickup: PorterLocationData;
  dropoff: PorterLocationData;
}

/**
 * Builds the structured Porter deep-link URL and fallback clipboard text for a given order.
 */
export function buildPorterDeepLink(order: Order): {
  androidIntentUrl: string;
  iosSchemeUrl: string;
  clipboardText: string;
  payload: PorterBookingPayload;
} {
  const pickup: PorterLocationData = {
    name: BUSINESS.name,
    phone: BUSINESS.phone,
    lat: BUSINESS.lat,
    lng: BUSINESS.lng,
    addressString: BUSINESS.kitchenAddress,
  };

  const dropLat = order.addressComponents?.lat ?? 12.9716;
  const dropLng = order.addressComponents?.lng ?? 77.5946;
  const dropAddress = order.addressComponents
    ? `${order.addressComponents.doorAndBuilding}, ${order.addressComponents.displayAddress}${
        order.addressComponents.landmark ? ` (Landmark: ${order.addressComponents.landmark})` : ""
      }`
    : order.deliveryAddress;

  const dropoff: PorterLocationData = {
    name: order.customerName,
    phone: order.phone,
    lat: dropLat,
    lng: dropLng,
    addressString: dropAddress,
  };

  const payload: PorterBookingPayload = { pickup, dropoff };

  // Copy-paste summary clipboard text
  const clipboardText = `📦 RAKU'S KITCHEN DELIVERY (#${order.orderId})\n` +
    `👤 Customer: ${dropoff.name}\n` +
    `📞 Mobile: ${dropoff.phone}\n` +
    `📍 Dropoff Address: ${dropoff.addressString}\n` +
    `🗺️ Coordinates: ${dropoff.lat}, ${dropoff.lng}`;

  // Android Intent URI (Targeting in.porter.android)
  const androidIntentUrl =
    `intent://book` +
    `?pickup_name=${encodeURIComponent(pickup.name)}` +
    `&pickup_phone=${encodeURIComponent(pickup.phone)}` +
    `&pickup_lat=${pickup.lat}` +
    `&pickup_lng=${pickup.lng}` +
    `&pickup_address=${encodeURIComponent(pickup.addressString)}` +
    `&drop_name=${encodeURIComponent(dropoff.name)}` +
    `&drop_phone=${encodeURIComponent(dropoff.phone)}` +
    `&drop_lat=${dropoff.lat}` +
    `&drop_lng=${dropoff.lng}` +
    `&drop_address=${encodeURIComponent(dropoff.addressString)}` +
    `#Intent;scheme=porter;package=in.porter.android;S.browser_fallback_url=${encodeURIComponent("https://play.google.com/store/apps/details?id=in.porter.android")};end`;

  // iOS Custom Scheme (porter://)
  const iosSchemeUrl =
    `porter://book` +
    `?pickup_name=${encodeURIComponent(pickup.name)}` +
    `&pickup_phone=${encodeURIComponent(pickup.phone)}` +
    `&pickup_lat=${pickup.lat}` +
    `&pickup_lng=${pickup.lng}` +
    `&pickup_address=${encodeURIComponent(pickup.addressString)}` +
    `&drop_name=${encodeURIComponent(dropoff.name)}` +
    `&drop_phone=${encodeURIComponent(dropoff.phone)}` +
    `&drop_lat=${dropoff.lat}` +
    `&drop_lng=${dropoff.lng}` +
    `&drop_address=${encodeURIComponent(dropoff.addressString)}`;

  return { androidIntentUrl, iosSchemeUrl, clipboardText, payload };
}

/**
 * Triggers the Porter mobile application on the admin's device via Deep Link,
 * simultaneously copying customer details to the clipboard.
 */
export async function launchPorterAppDeepLink(order: Order) {
  const { androidIntentUrl, iosSchemeUrl, clipboardText } = buildPorterDeepLink(order);

  // Copy customer details to clipboard as fallback
  try {
    await navigator.clipboard.writeText(clipboardText);
  } catch (err) {
    console.warn("Clipboard write failed:", err);
  }

  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isAndroid) {
    window.location.href = androidIntentUrl;
  } else if (isIOS) {
    window.location.href = iosSchemeUrl;
  } else {
    // Desktop browser fallback — open Android Intent URL & alert admin
    alert(
      `📱 Porter Deep Link Triggered!\n\n` +
      `Customer details copied to clipboard:\n${clipboardText}`,
    );
    window.location.href = androidIntentUrl;
  }
}
