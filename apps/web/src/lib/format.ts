import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { BUSINESS } from "@/lib/business";

export function money(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function maskHandle(handle: string | null | undefined): string {
  if (!handle) return "Unknown";
  if (handle.includes("@")) {
    const [user, domain] = handle.split("@");
    if (!user || !domain) return handle;
    return `${user.slice(0, 2)}••@${domain}`;
  }
  const digits = handle.replace(/\D/g, "");
  if (digits.length < 4) return handle;
  return `+1 ${digits.slice(-10, -7)} •••• ${digits.slice(-4)}`;
}

export function relativeTime(iso: string): string {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function localClock(now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS.timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
}

export function localDayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS.timezone,
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parseISO(iso));
}

export function tickerTime(iso: string): string {
  return format(parseISO(iso), "HH:mm:ss");
}

export function friendlyPickup(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS.timezone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(parseISO(iso));
}

/** "YYYY-MM-DD" for an instant, in the shop's timezone. */
export function localDateKey(at: Date | string, timeZone = BUSINESS.timezone): string {
  const d = typeof at === "string" ? parseISO(at) : at;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Minutes the zone is ahead of UTC at that instant (negative for Seattle). */
function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name ?? "");
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** The UTC instant of local midnight on `dateKey` ("YYYY-MM-DD") in the shop's timezone. */
export function localMidnight(dateKey: string, timeZone = BUSINESS.timezone): Date {
  const guess = new Date(`${dateKey}T00:00:00Z`);
  const offset = zoneOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offset * 60_000);
}

/** `dateKey` shifted by whole days. */
export function addDaysKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
