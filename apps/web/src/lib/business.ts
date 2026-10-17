import type { BusinessProfile } from "@boh/shared";

/** Mirrors data/seed/business.json until lane 3 merges seed files. */
export const BUSINESS: BusinessProfile = {
  name: "Larch & Rye",
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
  minutesSaved: {
    reply: 3,
    order: 5,
    counteroffer: 10,
    reorder: 8,
    guardCatch: 2,
  },
  voice:
    "Warm, brief, first names, no exclamation-mark spam, at most one emoji, signs off — Larch & Rye",
  poweredByFooter: "Sent with Back of House",
};

export const PRODUCT_NAMES: Record<string, string> = {
  "butter-croissant": "Butter croissant",
  "almond-croissant": "Almond croissant",
  "pain-au-chocolat": "Pain au chocolat",
  "morning-bun": "Morning bun",
  "oat-latte": "Oat latte",
  "sourdough-loaf": "Sourdough loaf",
};

export const INGREDIENT_NAMES: Record<string, { name: string; unit: string }> = {
  butter: { name: "Butter", unit: "kg" },
  "almond-flour": { name: "Almond flour", unit: "kg" },
  "oat-milk": { name: "Oat milk", unit: "L" },
  "bread-flour": { name: "Bread flour", unit: "kg" },
};
