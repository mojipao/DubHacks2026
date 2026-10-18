import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { BusinessProfile } from "@boh/shared";

const SEED_PATH = fileURLToPath(new URL("../../../data/seed/business.json", import.meta.url));

/** Used until lane 3 lands data/seed/business.json. Values follow planning/LANE-3-AGENTS.md. */
const DEFAULT_PROFILE: BusinessProfile = {
  name: "Mokha Coffee House",
  timezone: "America/Los_Angeles",
  hours: {
    mon: null,
    tue: { open: "07:00", close: "15:00" },
    wed: { open: "07:00", close: "15:00" },
    thu: { open: "07:00", close: "15:00" },
    fri: { open: "07:00", close: "15:00" },
    sat: { open: "08:00", close: "14:00" },
    sun: { open: "08:00", close: "14:00" },
  },
  minLeadHours: 12,
  cateringThresholdUnits: 24,
  cateringLeadHours: 48,
  largeOrderCents: 15000,
  welcomeBackAfterDays: 30,
  winbackOverdueFactor: 2.5,
  winbackMinOrders: 6,
  minutesSaved: { reply: 3, order: 5, counteroffer: 10, reorder: 8, guardCatch: 2 },
  voice: "Warm, brief, first names, no exclamation-mark spam, at most one emoji. Signs off \"— Mokha Coffee House\".",
  poweredByFooter: "Sent with Back of House",
};

export const business: BusinessProfile = existsSync(SEED_PATH)
  ? (JSON.parse(readFileSync(SEED_PATH, "utf8")) as BusinessProfile)
  : DEFAULT_PROFILE;
