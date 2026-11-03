import { describe, it, expect } from "vitest";
import { distanceKm, isWithinServiceArea, SERVICE_RADIUS_KM } from "./geofence";
import { BUSINESS } from "@/lib/config";

describe("distanceKm", () => {
  it("returns ~0 for the same point", () => {
    expect(distanceKm(BUSINESS.lat, BUSINESS.lng, BUSINESS.lat, BUSINESS.lng)).toBeCloseTo(0, 3);
  });

  it("matches a known reference distance (JP Nagar to MG Road, ~10km)", () => {
    // MG Road, Bengaluru: 12.9752, 77.6065
    const d = distanceKm(BUSINESS.lat, BUSINESS.lng, 12.9752, 77.6065);
    expect(d).toBeGreaterThan(8);
    expect(d).toBeLessThan(13);
  });
});

describe("isWithinServiceArea", () => {
  it("accepts the kitchen's own coordinates", () => {
    expect(isWithinServiceArea(BUSINESS.lat, BUSINESS.lng)).toBe(true);
  });

  it("accepts a point well inside the radius with no pincode", () => {
    // MG Road, ~10km away
    expect(isWithinServiceArea(12.9752, 77.6065)).toBe(true);
  });

  it("rejects a distant city (Mysore, ~130km away) even with no pincode", () => {
    expect(isWithinServiceArea(12.2958, 76.6394)).toBe(false);
  });

  it("rejects a distant city even if it somehow carries a 560 pincode", () => {
    // Guards against the grace window swallowing a clearly-wrong location.
    expect(isWithinServiceArea(12.2958, 76.6394, { pincode: "560001" })).toBe(false);
  });

  it("rejects a point just outside the radius with no pincode", () => {
    // ~0.5 degrees north is roughly 55km — beyond SERVICE_RADIUS_KM, no grace.
    expect(isWithinServiceArea(BUSINESS.lat + 0.5, BUSINESS.lng)).toBe(false);
  });

  it("grants grace to a point modestly beyond the radius with a confirmed 560xxx pincode", () => {
    // ~0.09 degrees lat ≈ 10km past the 40km radius, within the 25% grace window.
    const justBeyond = BUSINESS.lat + (SERVICE_RADIUS_KM + 8) / 111;
    expect(isWithinServiceArea(justBeyond, BUSINESS.lng)).toBe(false);
    expect(isWithinServiceArea(justBeyond, BUSINESS.lng, { pincode: "560100" })).toBe(true);
  });

  it("does not grant grace for a non-Bengaluru pincode", () => {
    const justBeyond = BUSINESS.lat + (SERVICE_RADIUS_KM + 8) / 111;
    expect(isWithinServiceArea(justBeyond, BUSINESS.lng, { pincode: "570001" })).toBe(false);
  });

  it("rejects Hosur, Tamil Nadu despite being well within the distance radius", () => {
    // Hosur is ~29.6km from the kitchen — closer than some legitimate Bengaluru
    // outskirts — but it's in Tamil Nadu, not Karnataka. This is the exact
    // regression a customer hit: a distance-only check let Hosur through.
    const hosur = { lat: 12.7409, lng: 77.8253 };
    expect(distanceKm(BUSINESS.lat, BUSINESS.lng, hosur.lat, hosur.lng)).toBeLessThan(SERVICE_RADIUS_KM);
    expect(isWithinServiceArea(hosur.lat, hosur.lng, { state: "Tamil Nadu" })).toBe(false);
  });

  it("accepts a Karnataka point within the radius when state is known", () => {
    expect(isWithinServiceArea(12.9752, 77.6065, { state: "Karnataka" })).toBe(true);
  });

  it("is case-insensitive on the state name", () => {
    expect(isWithinServiceArea(12.9752, 77.6065, { state: "KARNATAKA" })).toBe(true);
  });

  it("rejects a non-Karnataka state even with a 560xxx pincode and within the grace window", () => {
    const justBeyond = BUSINESS.lat + (SERVICE_RADIUS_KM + 8) / 111;
    expect(
      isWithinServiceArea(justBeyond, BUSINESS.lng, { pincode: "560100", state: "Tamil Nadu" }),
    ).toBe(false);
  });
});
