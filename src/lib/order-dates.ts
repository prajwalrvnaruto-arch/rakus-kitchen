import type { MealSlot } from "@/types";

// Business runs Monday–Thursday? No: holidays are Monday & Thursday (fixed weekly),
// plus a note that Sunday dinner isn't on the schedule poster. We serve Mon–Sun
// lunch, and Mon–Sat dinner, with Mon & Thu days entirely closed.
export const HOLIDAY_WEEKDAYS = [1, 4]; // JS getDay(): 1 = Monday, 4 = Thursday
export const NO_SUNDAY_DINNER = true;

export interface MealOption {
  date: string; // YYYY-MM-DD
  label: string;
  slot: MealSlot;
  /** Short human reason this option is excluded, if it is. */
  blocked?: boolean;
  reason?: string;
}

const weekdayName = (d: Date) =>
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/** Next N orderable days + their meal slots, honoring holidays and the no-Sunday-dinner rule.
 * Orders must be placed one day in advance, so today is excluded. */
export function upcomingMeals(count = 7): MealOption[] {
  const options: MealOption[] = [];
  const d = new Date();
  // advance to tomorrow
  d.setDate(d.getDate() + 1);

  while (options.length < count) {
    const dow = d.getDay();
    const isHoliday = HOLIDAY_WEEKDAYS.includes(dow);
    const date = dateKey(d);
    const label = `${weekdayName(d)}, ${d.getDate()} ${d.toLocaleString("en-IN", { month: "short" })}`;

    if (isHoliday) {
      options.push({ date, label, slot: "Lunch", blocked: true, reason: "Holiday (closed)" });
      options.push({ date, label, slot: "Dinner", blocked: true, reason: "Holiday (closed)" });
    } else {
      options.push({ date, label, slot: "Lunch" });
      if (NO_SUNDAY_DINNER && dow === 0) {
        options.push({ date, label, slot: "Dinner", blocked: true, reason: "Sunday dinner not served" });
      } else {
        options.push({ date, label, slot: "Dinner" });
      }
    }
    d.setDate(d.getDate() + 1);
  }
  return options;
}

/** Validate a chosen meal option at checkout — double-safety beyond the picker. */
export function validateMeal(option: { date: string; slot: MealSlot }): string | null {
  const [y, m, day] = option.date.split("-").map(Number);
  const chosen = new Date(y, m - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (chosen.getTime() <= today.getTime()) return "Orders must be placed at least one day in advance.";
  if (HOLIDAY_WEEKDAYS.includes(chosen.getDay())) return "Raku's Kitchen is closed on Mondays & Thursdays.";
  if (option.slot === "Dinner" && NO_SUNDAY_DINNER && chosen.getDay() === 0)
    return "Sunday dinner is not currently served.";
  return null;
}