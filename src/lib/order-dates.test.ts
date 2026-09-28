import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MAX_ADVANCE_DAYS, upcomingMeals, validateMeal } from "./order-dates";

// Format a Date as the "YYYY-MM-DD" key validateMeal / the picker use.
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const daysFromToday = (n: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

// Find the next date offset (>=1) whose weekday is a normal open day
// (not Mon=1 / Thu=4, and not a Sunday when checking dinner).
const nextOpenOffset = (opts: { forDinner?: boolean } = {}) => {
  for (let n = 1; n <= 14; n++) {
    const dow = daysFromToday(n).getDay();
    if (dow === 1 || dow === 4) continue;
    if (opts.forDinner && dow === 0) continue;
    return n;
  }
  throw new Error("no open day found");
};

describe("upcomingMeals", () => {
  it("returns the requested number of day-slot options and never includes today", () => {
    const meals = upcomingMeals(7);
    // At least 7 options, and the first date is strictly after today.
    expect(meals.length).toBeGreaterThanOrEqual(7);
    expect(meals[0].date > key(daysFromToday(0))).toBe(true);
  });

  it("blocks Monday and Thursday with a holiday reason", () => {
    const meals = upcomingMeals(10);
    const holidayLunches = meals.filter(
      (m) => m.slot === "Lunch" && [1, 4].includes(new Date(m.date + "T00:00:00").getDay()),
    );
    for (const m of holidayLunches) {
      expect(m.blocked).toBe(true);
      expect(m.reason).toMatch(/holiday/i);
    }
  });

  it("blocks Sunday dinner but not Sunday lunch", () => {
    const meals = upcomingMeals(14);
    const sundayDinner = meals.find(
      (m) => m.slot === "Dinner" && new Date(m.date + "T00:00:00").getDay() === 0,
    );
    if (sundayDinner) {
      expect(sundayDinner.blocked).toBe(true);
      expect(sundayDinner.reason).toMatch(/sunday dinner/i);
    }
  });
});

describe("validateMeal", () => {
  it("accepts a valid open day within the window", () => {
    const offset = nextOpenOffset();
    expect(validateMeal({ date: key(daysFromToday(offset)), slot: "Lunch" })).toBeNull();
  });

  it("rejects today or the past (one-day-advance rule)", () => {
    expect(validateMeal({ date: key(daysFromToday(0)), slot: "Lunch" })).toMatch(/one day in advance/i);
    expect(validateMeal({ date: key(daysFromToday(-3)), slot: "Lunch" })).toMatch(/one day in advance/i);
  });

  it("rejects a date beyond MAX_ADVANCE_DAYS (H1 — far-future guard)", () => {
    const tooFar = key(daysFromToday(MAX_ADVANCE_DAYS + 5));
    expect(validateMeal({ date: tooFar, slot: "Lunch" })).toMatch(/days in advance/i);
  });

  it("rejects Monday and Thursday", () => {
    // Find a Monday within the window.
    for (let n = 1; n <= MAX_ADVANCE_DAYS; n++) {
      const d = daysFromToday(n);
      if (d.getDay() === 1) {
        expect(validateMeal({ date: key(d), slot: "Lunch" })).toMatch(/closed on mondays/i);
        return;
      }
    }
  });

  it("rejects Sunday dinner", () => {
    for (let n = 1; n <= MAX_ADVANCE_DAYS; n++) {
      const d = daysFromToday(n);
      if (d.getDay() === 0) {
        expect(validateMeal({ date: key(d), slot: "Dinner" })).toMatch(/sunday dinner/i);
        return;
      }
    }
  });

  it("uses the server clock: a fixed date behaves deterministically", () => {
    // Pin 'now' to a known Tuesday (2026-09-29) so the assertion is stable.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T10:00:00"));
    // Wednesday 2026-09-30 is one day ahead, open, within window.
    expect(validateMeal({ date: "2026-09-30", slot: "Lunch" })).toBeNull();
    vi.useRealTimers();
  });
});

// Keep timers clean even if an assertion above throws mid-test.
beforeEach(() => {});
afterEach(() => {
  vi.useRealTimers();
});
