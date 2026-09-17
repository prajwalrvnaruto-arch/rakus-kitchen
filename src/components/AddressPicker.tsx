/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import type { AddressComponents } from "@/types";

/* ── Google Maps SDK loader ─────────────────────────────────────────────── */

/**
 * Injects the Google Maps JS SDK (with Places library) once and resolves
 * when window.google.maps.places is available. Safe for React fast-refresh
 * (the script element is id-guarded to prevent double injection).
 */
function useGoogleMapsLoaded(): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    // Already available (e.g. from fast-refresh re-mount).
    if ((window as any).google?.maps?.places) {
      setLoaded(true);
      return;
    }

    const SCRIPT_ID = "rk-google-maps";

    if (document.getElementById(SCRIPT_ID)) {
      // Script tag exists but hasn't resolved yet — poll until ready.
      const timer = setInterval(() => {
        if ((window as any).google?.maps?.places) {
          setLoaded(true);
          clearInterval(timer);
        }
      }, 100);
      return () => clearInterval(timer);
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    script.onerror = () =>
      console.error("[AddressPicker] Failed to load Google Maps SDK. Check your API key.");
    document.head.appendChild(script);
  }, []);

  return loaded;
}

/* ── Geocoding helpers ──────────────────────────────────────────────────── */

interface CityPincode {
  city: string;
  pincode: string;
}

/**
 * Extracts city name and pincode from a Google Geocoder result's
 * address_components array. City falls back through locality →
 * administrative_area_level_2 → administrative_area_level_1.
 */
function extractCityPincode(components: any[]): CityPincode {
  let city = "";
  let pincode = "";
  for (const c of components) {
    const types: string[] = c.types ?? [];
    if (types.includes("locality") && !city) city = c.long_name;
    if (types.includes("administrative_area_level_2") && !city) city = c.long_name;
    if (types.includes("administrative_area_level_1") && !city) city = c.long_name;
    if (types.includes("postal_code")) pincode = c.long_name;
  }
  return { city, pincode };
}

/* ── Component ──────────────────────────────────────────────────────────── */

interface AddressPickerProps {
  /** Current structured address value (null if not yet set). */
  value: AddressComponents | null;
  /** Called whenever any field changes. Emits null when the address is cleared. */
  onChange: (addr: AddressComponents | null) => void;
}

/**
 * A structured, delivery-optimised address collection widget.
 *
 * Flow:
 *  Step 1 — Main address: Google Places Autocomplete text input OR
 *            "📍 My location" button (GPS + reverse geocode).
 *  Step 2 — Drop-off details: mandatory Flat/Building field + optional Landmark.
 *
 * Emits a complete `AddressComponents` object containing coordinates,
 * verified address string, door/building, landmark, city, and pincode.
 *
 * Gracefully degrades to a plain textarea when
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is not configured.
 */
export function AddressPicker({ value, onChange }: AddressPickerProps) {
  const hasKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapsLoaded = useGoogleMapsLoaded();

  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  // Internal state — each piece can change independently.
  const [mainAddress, setMainAddress] = useState(value?.displayAddress ?? "");
  const [doorAndBuilding, setDoorAndBuilding] = useState(value?.doorAndBuilding ?? "");
  const [landmark, setLandmark] = useState(value?.landmark ?? "");
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
    placeId?: string;
  } | null>(
    value ? { lat: value.lat, lng: value.lng, placeId: value.googlePlaceId } : null,
  );
  const [cityPincode, setCityPincode] = useState<CityPincode>({
    city: value?.city ?? "",
    pincode: value?.pincode ?? "",
  });

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  /* ── Bind Google Places Autocomplete once SDK is ready ──────────────── */
  useEffect(() => {
    if (!mapsLoaded || !inputRef.current || autocompleteRef.current) return;

    const gm = (window as any).google.maps;
    autocompleteRef.current = new gm.places.Autocomplete(inputRef.current, {
      // Bias suggestions to India — kitchen & customers are all Bangalore.
      componentRestrictions: { country: "in" },
      fields: ["formatted_address", "geometry", "place_id", "address_components"],
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace();
      if (!place?.geometry?.location) return;

      const lat: number = place.geometry.location.lat();
      const lng: number = place.geometry.location.lng();
      const displayAddress: string = place.formatted_address ?? "";
      const placeId: string | undefined = place.place_id;

      setMainAddress(displayAddress);
      setCoords({ lat, lng, placeId });
      if (place.address_components) {
        setCityPincode(extractCityPincode(place.address_components));
      }
    });
  }, [mapsLoaded]);

  /* ── Emit updated AddressComponents whenever any piece changes ──────── */
  useEffect(() => {
    if (!coords || !mainAddress) {
      onChange(null);
      return;
    }
    onChange({
      lat: coords.lat,
      lng: coords.lng,
      googlePlaceId: coords.placeId,
      displayAddress: mainAddress,
      doorAndBuilding,
      landmark: landmark.trim() || undefined,
      city: cityPincode.city,
      pincode: cityPincode.pincode,
    });
    // onChange is intentionally excluded — including it would cause infinite loops
    // if the parent re-creates the callback on every render. Parent should memoize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, mainAddress, doorAndBuilding, landmark, cityPincode.city, cityPincode.pincode]);

  /* ── GPS location handler ───────────────────────────────────────────── */
  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (!mapsLoaded) {
          // SDK not ready yet — save coordinates without reverse geocoding.
          setCoords({ lat, lng });
          setGpsLoading(false);
          return;
        }

        const gm = (window as any).google.maps;
        new gm.Geocoder().geocode(
          { location: { lat, lng } },
          (results: any[], status: string) => {
            setGpsLoading(false);
            if (status === "OK" && results?.[0]) {
              const r = results[0];
              const display: string = r.formatted_address ?? "";
              setMainAddress(display);
              setCoords({ lat, lng, placeId: r.place_id });
              setCityPincode(extractCityPincode(r.address_components ?? []));
              // Sync the visible input value with the reverse-geocoded string.
              if (inputRef.current) inputRef.current.value = display;
            } else {
              // Reverse geocode failed — keep raw coordinates, show a warning.
              setCoords({ lat, lng });
              setGpsError(
                "Got your location but couldn't look up the address. " +
                  "Please type your area in the box above.",
              );
            }
          },
        );
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError(
            "Location access was denied. Please type your address in the box above.",
          );
        } else {
          setGpsError("Couldn't get your location. Please type your address.");
        }
      },
      { timeout: 12000, maximumAge: 30000 },
    );
  };

  const addressConfirmed = !!coords && !!mainAddress;

  /* ── Fallback: no Google Maps key configured ────────────────────────── */
  if (!hasKey) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-turmeric/10 px-3 py-2 text-xs text-turmerick">
          ℹ️ Add <code className="rounded bg-turmeric/20 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          to <code className="rounded bg-turmeric/20 px-1">.env.local</code> for smart address
          search and GPS detection.
        </p>
        <textarea
          rows={3}
          className="field resize-none"
          placeholder="House / flat, street, area, landmark…"
          value={value?.displayAddress ?? ""}
          onChange={(e) =>
            onChange({
              lat: 0,
              lng: 0,
              displayAddress: e.target.value,
              doorAndBuilding: value?.doorAndBuilding ?? e.target.value,
              city: "",
              pincode: "",
            })
          }
          required
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Step 1: Main address input ─────────────────────────────────── */}
      <div className="relative">
        <input
          ref={inputRef}
          id="address-search"
          type="text"
          className="field pr-32"
          placeholder={
            mapsLoaded
              ? "Search your street, area or building…"
              : "Loading maps…"
          }
          defaultValue={value?.displayAddress ?? ""}
          onChange={(e) => {
            // If the user clears the field manually, reset the confirmed state.
            if (!e.target.value) {
              setMainAddress("");
              setCoords(null);
              onChange(null);
            }
          }}
          autoComplete="off"
          spellCheck={false}
          aria-label="Delivery address search"
        />
        <button
          type="button"
          onClick={handleUseLocation}
          disabled={gpsLoading}
          className="absolute right-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-turmeric/20 px-2.5 py-1 text-xs font-semibold text-turmerick transition hover:bg-turmeric/30 disabled:opacity-50"
          aria-label="Detect my location"
        >
          {gpsLoading ? "Locating…" : "📍 My location"}
        </button>
      </div>

      {gpsError && (
        <p role="alert" className="text-xs font-medium text-chili">
          {gpsError}
        </p>
      )}

      {/* Confirmed address badge + "View on Google Maps" link */}
      {addressConfirmed && (
        <div className="flex items-start gap-2 rounded-xl border border-ok/30 bg-ok/5 px-3 py-2.5 text-xs">
          <span className="mt-0.5 shrink-0 text-ok" aria-hidden>
            ✓
          </span>
          <div>
            <p className="font-semibold text-ink">{mainAddress}</p>
            <a
              href={`https://maps.google.com/?q=${coords.lat},${coords.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-block text-chilidark underline underline-offset-2 hover:text-ink"
            >
              Verify on Google Maps ↗
            </a>
          </div>
        </div>
      )}

      {/* Hint when nothing is confirmed yet */}
      {!addressConfirmed && !gpsError && (
        <p className="text-xs text-soft">
          Type your area or building name above, or tap{" "}
          <span className="font-semibold">📍 My location</span> to auto-fill.
        </p>
      )}

      {/* ── Step 2: Drop-off specifics — shown only after main address is set ── */}
      {addressConfirmed && (
        <div className="space-y-3 rounded-xl border border-line bg-cream/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-soft">
            Drop-off details
          </p>

          <div>
            <label
              htmlFor="door-and-building"
              className="mb-1.5 block text-sm font-semibold"
            >
              Flat / House No. / Floor / Building{" "}
              <span className="text-chili" aria-hidden>
                *
              </span>
            </label>
            <input
              id="door-and-building"
              type="text"
              className="field"
              placeholder="e.g. Flat 4B, 3rd Floor, Prestige Tower"
              value={doorAndBuilding}
              onChange={(e) => setDoorAndBuilding(e.target.value)}
              required
              minLength={3}
              aria-required="true"
            />
            <p className="mt-1 text-xs text-soft">
              This is what the delivery driver needs to find your exact door.
            </p>
          </div>

          <div>
            <label
              htmlFor="landmark"
              className="mb-1.5 block text-sm font-semibold"
            >
              Landmark{" "}
              <span className="text-xs font-normal text-soft">
                (optional — helps the driver)
              </span>
            </label>
            <input
              id="landmark"
              type="text"
              className="field"
              placeholder="e.g. Opposite Metro Station, Near HDFC Bank"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
