// Client-side wrappers for the Ola Maps proxy routes (src/app/api/maps/*).
// Keeps the API key server-only — the browser never talks to Ola Maps directly.
//
// The proxy routes now require a signed-in Firebase user (they proxy billable
// Ola calls, so anonymous access is closed). These wrappers attach the current
// user's ID token; address entry only happens mid-checkout where the user is
// already signed in.

import { auth } from "./firebase";

export interface PlaceSuggestion {
  label: string;
  lat: number;
  lng: number;
  city: string;
  pincode: string;
  placeId?: string;
}

/** Authorization header for the current signed-in user, or {} if none. */
async function authHeader(): Promise<Record<string, string>> {
  const user = auth?.currentUser;
  if (!user) return {};
  try {
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  } catch {
    return {};
  }
}

/**
 * Forward search — as-you-type address suggestions.
 * Pass an AbortSignal so the caller can cancel stale requests while debouncing.
 */
export async function autocomplete(
  query: string,
  signal?: AbortSignal,
  biasLat?: number,
  biasLng?: number,
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (!q) return [];

  let url = `/api/maps/autocomplete?q=${encodeURIComponent(q)}`;
  if (biasLat !== undefined && biasLng !== undefined) {
    url += `&lat=${biasLat}&lng=${biasLng}`;
  }

  const res = await fetch(url, { signal, headers: await authHeader() });
  if (!res.ok) throw new Error(`Autocomplete request failed (${res.status})`);
  const data = (await res.json()) as { results: PlaceSuggestion[] };
  return data.results ?? [];
}

/** Reverse geocode — turns GPS coordinates into a confirmed address.
 *  Accepts an optional AbortSignal for parity with autocomplete, so a caller
 *  can cancel a stale request. */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<PlaceSuggestion | null> {
  const res = await fetch(`/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`, {
    signal,
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(`Reverse geocode request failed (${res.status})`);
  const data = (await res.json()) as { result: PlaceSuggestion | null };
  return data.result;
}
