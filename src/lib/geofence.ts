// Bengaluru-only delivery zone check — shared by the client (AddressPicker,
// for immediate feedback) and the server (create-order, as the actual gate).
//
// A straight-line radius from the kitchen CANNOT be the only signal: Hosur
// (Tamil Nadu) is only ~30km from the JP Nagar kitchen — closer than some
// legitimate Bengaluru outskirts like Electronic City or Anekal — so a radius
// alone either lets Hosur in or excludes real Bengaluru addresses. State
// (Karnataka) is the authoritative, non-negotiable gate; distance is a
// secondary check for points that are in-state but simply too far (e.g. a
// Karnataka address near Mysore).

import { BUSINESS } from "@/lib/config";

/** Max straight-line distance (km) from the kitchen we treat as serviceable,
 *  once the state check has already passed. */
export const SERVICE_RADIUS_KM = 40;

/** Bengaluru pincodes are all in the 560xxx series — used only as a secondary
 *  signal to grant a little grace near the radius boundary, never to override
 *  the state check. */
const BENGALURU_PINCODE_PREFIX = "560";

const KARNATAKA_STATE_NAMES = ["karnataka"];

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine great-circle distance between two lat/lng points, in km. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Is this point inside our Bengaluru delivery zone?
 *
 * Gate 1 (hard, state-based): when a state is known, it MUST be Karnataka —
 * this is what actually excludes Hosur, which is otherwise well inside any
 * sane radius. No distance or pincode can override this.
 *
 * Gate 2 (distance): within SERVICE_RADIUS_KM of the kitchen. A confirmed
 * 560xxx pincode grants a modest 25% grace beyond the radius for GPS noise
 * near the boundary — it never rescues a point outside Karnataka or far
 * outside the radius.
 *
 * When state is unknown (e.g. autocomplete predictions before their
 * reverse-geocode fallback resolves), this falls back to distance + pincode
 * only — callers that can wait for the state lookup should.
 */
export function isWithinServiceArea(
  lat: number,
  lng: number,
  opts?: { pincode?: string; state?: string },
): boolean {
  const state = opts?.state?.trim().toLowerCase();
  if (state && !KARNATAKA_STATE_NAMES.includes(state)) return false;

  const distance = distanceKm(BUSINESS.lat, BUSINESS.lng, lat, lng);
  if (distance <= SERVICE_RADIUS_KM) return true;

  const isBengaluruPincode = !!opts?.pincode?.trim().startsWith(BENGALURU_PINCODE_PREFIX);
  return isBengaluruPincode && distance <= SERVICE_RADIUS_KM * 1.25;
}

export const OUT_OF_SERVICE_AREA_MESSAGE =
  "We're sorry, we only deliver within Bengaluru right now. Please choose an address inside the city.";
