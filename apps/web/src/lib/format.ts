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
