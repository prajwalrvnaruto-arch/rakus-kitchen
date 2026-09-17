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
  fullSummary: string;
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

  // Format clean address string for 1-tap Gboard/Keyboard paste chip
  const clipboardText = dropAddress;

  // Detailed summary clipboard text (logged/available if needed)
  const fullSummary = `📦 RAKU'S KITCHEN DELIVERY (#${order.orderId})\n` +
    `👤 Customer: ${dropoff.name}\n` +
    `📞 Mobile: ${dropoff.phone}\n` +
    `📍 Dropoff Address: ${dropoff.addressString}`;

  // Direct Android Intent URI (Launches com.theporter.android.customerapp directly without Play Store page)
  const androidIntentUrl =
    `intent://#Intent;package=com.theporter.android.customerapp;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;end`;

  // iOS Custom Scheme (porter://)
  const iosSchemeUrl = `porter://`;

  return { androidIntentUrl, iosSchemeUrl, clipboardText, fullSummary, payload };
}

/**
 * Triggers the Porter mobile application on the admin's device via Deep Link,
 * simultaneously copying customer details to the clipboard.
 */
export async function launchPorterAppDeepLink(order: Order) {
  const { androidIntentUrl, iosSchemeUrl, clipboardText } = buildPorterDeepLink(order);

  // Copy clean dropoff address to clipboard so Gboard / keyboard displays 1-tap paste chip
  try {
    await navigator.clipboard.writeText(clipboardText);
    alert(
      `📋 Address copied to clipboard!\n\n` +
      `📍 ${clipboardText}\n\n` +
      `Opening Porter app...\nTap the search box in Porter and tap Paste!`,
    );
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
    // Desktop browser fallback
    window.location.href = androidIntentUrl;
  }
}
