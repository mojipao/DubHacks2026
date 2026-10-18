/** Local-date math in the business timezone, without assuming the server's timezone. Local dates are "YYYY-MM-DD". */

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function localDateOf(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function addDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayOf(localDate: string): Weekday {
  return WEEKDAYS[new Date(`${localDate}T12:00:00Z`).getUTCDay()]!;
}

/** Milliseconds the zone is ahead of UTC at that instant. */
function offsetMs(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;
  const asUtc = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant a wall-clock time ("09:00") occurs on a local date in the zone. */
export function zonedTime(localDate: string, time: string, timeZone: string): Date {
  const [y, m, d] = localDate.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMs(new Date(guess), timeZone);
  // A second pass settles instants near a DST change.
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2}(\.\d+)?)?$/;

/** "2026-10-23T07:00" (no zone) → the full instant in the business zone; anything else is returned unchanged. */
export function completeLocalDateTime(value: string, timeZone: string): string {
  const m = LOCAL_DATE_TIME.exec(value);
  return m ? zonedTime(m[1]!, m[2]!, timeZone).toISOString() : value;
}

/** [start, end) of a local date as UTC ISO strings, for range queries. */
export function dayBounds(localDate: string, timeZone: string): [string, string] {
  return [zonedTime(localDate, "00:00", timeZone).toISOString(), zonedTime(addDays(localDate, 1), "00:00", timeZone).toISOString()];
}

/** The first given weekday strictly after a local date. This is how "Saturday" resolves everywhere. */
export function nextWeekday(localDate: string, day: Weekday): string {
  for (let i = 1; i <= 7; i++) {
    const candidate = addDays(localDate, i);
    if (weekdayOf(candidate) === day) return candidate;
  }
  throw new Error("unreachable");
}

const WEEKDAY_WORDS: Record<string, Weekday> = {
  monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun",
  mon: "mon", tue: "tue", tues: "tue", wed: "wed", thu: "thu", thur: "thu", thurs: "thu", fri: "fri", sat: "sat", sun: "sun",
};

/** "today", "tomorrow", "Saturday" (the next one after today), or "2026-10-24" → a local date. Unrecognised → null. */
export function resolveSpokenDay(spoken: string | undefined, today: string): string | null {
  const s = (spoken ?? "today").trim().toLowerCase().replace(/^(this|next|on)\s+/, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s === "" || s === "today" || s === "now") return today;
  if (s === "tomorrow") return addDays(today, 1);
  const day = WEEKDAY_WORDS[s.replace(/s$/, "")] ?? WEEKDAY_WORDS[s];
  if (!day) return null;
  // Same rule as the agents and the seed: a weekday name means the first one strictly after today.
  return nextWeekday(today, day);
}
