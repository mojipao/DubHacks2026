/**
 * Business-timezone date math. No date library: `Intl` already knows every rule
 * that matters here, and `@boh/agents` keeps its dependency list to the SDK and zod.
 *
 * Everything the agents reason about is a *local* date in the shop's timezone
 * ("YYYY-MM-DD") or a local wall-clock time ("YYYY-MM-DDTHH:mm"). Only the final
 * `pickupAt` on an `OrderDraft` is an absolute ISO timestamp with an offset.
 */
import type { BusinessProfile } from "@boh/shared";

export type WeekdayKey = keyof BusinessProfile["hours"];

const WEEKDAYS: readonly WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** "2026-10-17" for an instant, in the business timezone. */
export function localDate(at: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "09:05" for an instant, in the business timezone. */
export function localTime(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

/** The timezone's UTC offset at a given instant, in minutes. */
function offsetMinutes(at: Date, timezone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** "-07:00" for an instant, so an ISO string can carry the shop's offset. */
export function offsetLabel(at: Date, timezone: string): string {
  const minutes = offsetMinutes(at, timezone);
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/**
 * Turns a local wall-clock time in the business timezone into an absolute instant.
 * Guess once from the UTC reading, then correct with the offset that actually applies
 * at that moment, which is what makes DST boundaries come out right.
 */
export function instantFromLocal(localDateTime: string, timezone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(localDateTime);
  if (!match) throw new Error(`not a local date-time: "${localDateTime}"`);
  const [, y, mo, d, h, mi] = match as unknown as [string, string, string, string, string, string];
  const asUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  const firstGuess = new Date(asUtc - offsetMinutes(new Date(asUtc), timezone) * 60_000);
  return new Date(asUtc - offsetMinutes(firstGuess, timezone) * 60_000);
}

/** ISO 8601 with the shop's offset, which is what `IsoDateTime` in `@boh/shared` validates. */
export function isoWithOffset(localDateTime: string, timezone: string): string {
  const at = instantFromLocal(localDateTime, timezone);
  return `${localDate(at, timezone)}T${localTime(at, timezone)}:00${offsetLabel(at, timezone)}`;
}

export function weekdayOf(localDateString: string, timezone: string): WeekdayKey {
  const at = instantFromLocal(`${localDateString}T12:00`, timezone);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(at);
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
  return WEEKDAYS[index === -1 ? 0 : index] as WeekdayKey;
}

export function addDays(localDateString: string, days: number): string {
  const [y, m, d] = localDateString.split("-").map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return at.toISOString().slice(0, 10);
}

/**
 * "Saturday" means the first Saturday **strictly after** today, which is also how
 * `scripts/generate-history.ts` resolves `next_sat`.
 */
export function nextWeekday(fromLocalDate: string, weekday: WeekdayKey, timezone: string): string {
  for (let i = 1; i <= 7; i++) {
    const candidate = addDays(fromLocalDate, i);
    if (weekdayOf(candidate, timezone) === weekday) return candidate;
  }
  throw new Error(`no ${weekday} within 7 days of ${fromLocalDate}`);
}

/**
 * The Sunday of the counteroffer is **the day after `next_sat`**, not the first Sunday
 * after today. Read the other way, a Saturday seed makes "Sunday" the same weekend the
 * shop is already working, which for this build is demo day itself.
 */
export function nextSaturdayAndSunday(fromLocalDate: string, timezone: string): { sat: string; sun: string } {
  const sat = nextWeekday(fromLocalDate, "sat", timezone);
  return { sat, sun: addDays(sat, 1) };
}

export function isOpenOn(localDateString: string, business: BusinessProfile): boolean {
  return business.hours[weekdayOf(localDateString, business.timezone)] !== null;
}

/** The next `count` open days strictly after `fromLocalDate`. */
export function openDaysAfter(fromLocalDate: string, count: number, business: BusinessProfile): string[] {
  const days: string[] = [];
  for (let i = 1; days.length < count && i <= 21; i++) {
    const candidate = addDays(fromLocalDate, i);
    if (isOpenOn(candidate, business)) days.push(candidate);
  }
  return days;
}

export interface HoursVerdict {
  open: boolean;
  withinHours: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

export function checkHours(localDateTime: string, business: BusinessProfile): HoursVerdict {
  const [date = "", time = ""] = localDateTime.split("T");
  const hours = business.hours[weekdayOf(date, business.timezone)];
  if (!hours) return { open: false, withinHours: false, opensAt: null, closesAt: null };
  return {
    open: true,
    withinHours: time >= hours.open && time <= hours.close,
    opensAt: hours.open,
    closesAt: hours.close,
  };
}

export function hoursUntil(localDateTime: string, now: Date, timezone: string): number {
  return (instantFromLocal(localDateTime, timezone).getTime() - now.getTime()) / 3_600_000;
}

/** "Sat 10/24 9:00am", for reply text and payment-link line items. */
export function friendlyPickup(localDateTime: string, timezone: string): string {
  const at = instantFromLocal(localDateTime, timezone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(at);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  const minute = get("minute") === "00" ? "" : `:${get("minute")}`;
  return `${get("weekday")} ${get("month")}/${get("day")} ${get("hour")}${minute}${get("dayPeriod").toLowerCase()}`;
}
