/**
 * Writes `data/seed/orders.json`: the synthetic order history Larch & Rye runs on.
 *
 *   pnpm tsx scripts/generate-history.ts
 *
 * Dates are relative to **seed time**, not generation time, so the data never goes
 * stale overnight. `scripts/seed.ts` (lane 2) turns `daysAgo` and `pickupDay` into
 * timestamps in the business timezone and computes every total from `products`.
 *
 * Deterministic: one fixed PRNG seed, consumed in a fixed order, so reruns produce a
 * byte-identical file. Order ids are derived from that PRNG rather than `randomUUID`
 * for the same reason.
 *
 * ## Weekday assumption
 *
 * `daysAgo` only becomes a weekday once the seed runs, so this generator places history
 * orders by their offset **from the seed day**, assuming the seed runs on a **Saturday**
 * (milestone M0, and the pre-demo reset). Under that assumption `daysAgo % 7` is:
 *
 *   0 Sat · 1 Fri · 2 Thu · 3 Wed · 4 Tue · 5 Mon (closed) · 6 Sun
 *
 * so residue 5 is never used and no history order lands on a closed Monday. Residues 0
 * and 6 are over-weighted, which is where the weekend peak comes from. Seed on another
 * day and the pattern rotates; nothing breaks, but a few pickups drift to a Monday.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../data/seed/orders.json", import.meta.url));
const CUSTOMERS = fileURLToPath(new URL("../data/seed/customers.json", import.meta.url));

const PRNG_SEED = 0x5a1c_9e27;
const HISTORY_WINDOW_DAYS = 120;
const TARGET_HISTORY_ORDERS = 400;

interface SeedItem {
  productId: string;
  qty: number;
}

type SeedOrder =
  | { id: string; customerId: string; kind: "history"; daysAgo: number; pickupLocalTime: string; items: SeedItem[] }
  | {
      id: string;
      customerId: string;
      kind: "upcoming";
      pickupDay: "next_sat" | "next_sun";
      pickupLocalTime: string;
      items: SeedItem[];
    };

interface SeedCustomer {
  id: string;
  personaKey?: string;
  name: string;
}

/** mulberry32: small, fast, and stable across Node versions, which `Math.random` is not. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b_79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const rng = mulberry32(PRNG_SEED);

const pick = <T,>(items: readonly T[]): T => {
  const value = items[Math.floor(rng() * items.length)];
  if (value === undefined) throw new Error("pick from an empty list");
  return value;
};

const intBetween = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));

/** v4-shaped id from the seeded PRNG, so the same seed always yields the same order ids. */
function seededUuid(): string {
  const hex: string[] = [];
  for (let i = 0; i < 32; i++) hex.push(Math.floor(rng() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16] as string, 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

const customers: SeedCustomer[] = JSON.parse(readFileSync(CUSTOMERS, "utf8")) as SeedCustomer[];

const byPersona = new Map(customers.filter((c) => c.personaKey).map((c) => [c.personaKey as string, c.id]));
const persona = (key: string): string => {
  const id = byPersona.get(key);
  if (!id) throw new Error(`data/seed/customers.json has no persona "${key}"`);
  return id;
};
/** Personas have scripted histories, so the random walk only uses everybody else. */
const walkIns = customers.filter((c) => !c.personaKey).map((c) => c.id);

const orders: SeedOrder[] = [];

// ---------------------------------------------------------------------------
// Persona histories. Every `daysAgo` is a multiple of 7, so each persona's
// pickups all land on the same weekday as the seed day: Saturdays for a
// Saturday seed, which is the story the demo tells.
// ---------------------------------------------------------------------------

const MAYA_USUAL: SeedItem[] = [
  { productId: "almond-croissant", qty: 2 },
  { productId: "oat-latte", qty: 1 },
];

/**
 * 14 Saturdays, weekly, last visit 42 days (six weeks) ago, which is what the demo
 * script says out loud and which clears `welcomeBackAfterDays` of 30 for the perk.
 * Variations sit at indices 2, 6, 9, and 13 so that exactly 9 of her last 12 orders
 * are the usual, matching the evidence chip in planning/LANE-3-AGENTS.md.
 */
const MAYA_VARIATIONS: Record<number, SeedItem[]> = {
  2: [
    { productId: "almond-croissant", qty: 2 },
    { productId: "oat-latte", qty: 1 },
    { productId: "morning-bun", qty: 1 },
  ],
  6: [
    { productId: "almond-croissant", qty: 1 },
    { productId: "oat-latte", qty: 1 },
  ],
  9: [
    { productId: "almond-croissant", qty: 2 },
    { productId: "drip-coffee", qty: 1 },
  ],
  13: [
    { productId: "almond-croissant", qty: 2 },
    { productId: "oat-latte", qty: 1 },
    { productId: "sourdough-loaf", qty: 1 },
  ],
};

for (let i = 0; i < 14; i++) {
  orders.push({
    id: seededUuid(),
    customerId: persona("maya"),
    kind: "history",
    daysAgo: 42 + i * 7,
    pickupLocalTime: "09:00",
    items: MAYA_VARIATIONS[i] ?? MAYA_USUAL,
  });
}

/**
 * Jun's two catering orders, 36 mixed pastries each. The most recent is 21 days ago,
 * inside `welcomeBackAfterDays`, so his 4-dozen-croissant ask in the demo does not
 * also pick up a welcome-back discount and muddy the counteroffer.
 */
const JUN_CATERING: SeedItem[] = [
  { productId: "butter-croissant", qty: 12 },
  { productId: "almond-croissant", qty: 12 },
  { productId: "pain-au-chocolat", qty: 6 },
  { productId: "morning-bun", qty: 6 },
];

for (const daysAgo of [21, 63]) {
  orders.push({
    id: seededUuid(),
    customerId: persona("jun"),
    kind: "history",
    daysAgo,
    pickupLocalTime: "08:30",
    items: JUN_CATERING,
  });
}

/** Priya: two orders, nothing with almond in them, last visit inside the perk window. */
orders.push({
  id: seededUuid(),
  customerId: persona("priya"),
  kind: "history",
  daysAgo: 28,
  pickupLocalTime: "10:00",
  items: [
    { productId: "quiche-slice", qty: 1 },
    { productId: "drip-coffee", qty: 1 },
  ],
});
orders.push({
  id: seededUuid(),
  customerId: persona("priya"),
  kind: "history",
  daysAgo: 70,
  pickupLocalTime: "10:00",
  items: [
    { productId: "sourdough-loaf", qty: 1 },
    { productId: "oat-latte", qty: 1 },
  ],
});

/**
 * Elena: the win-back candidate. 7 orders on a 14-day cadence, last one 42 days ago,
 * so days-since-last (42) clears `winbackOverdueFactor` 2.5 x median interval (35)
 * with room to spare instead of tying it, and 7 clears `winbackMinOrders` of 6.
 * Her oldest order is 126 days back, just outside the 120-day window, which is
 * allowed for persona histories.
 */
for (let i = 0; i < 7; i++) {
  const extras: SeedItem[] = i % 3 === 0 ? [{ productId: "cardamom-knot", qty: 2 }] : [];
  orders.push({
    id: seededUuid(),
    customerId: persona("elena"),
    kind: "history",
    daysAgo: 42 + i * 14,
    pickupLocalTime: "09:30",
    items: [{ productId: "rye-loaf", qty: 1 }, { productId: "drip-coffee", qty: 1 }, ...extras],
  });
}

// ---------------------------------------------------------------------------
// Walk-in history: ~400 orders over 120 days with weekend peaks.
// ---------------------------------------------------------------------------

/**
 * Residue of `daysAgo % 7`, weighted so the weekend carries the peak without swallowing
 * the week: Saturday 27%, Sunday 20%, each open weekday 13%. Residue 5 (Monday, closed)
 * is absent.
 */
const DAY_WEIGHTS: readonly number[] = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 6, 6, 6];

const WEEKEND_TIMES = ["08:15", "08:30", "09:00", "09:15", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"];
const WEEKDAY_TIMES = ["07:15", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "11:00", "12:30", "14:00"];

/** Weighted so the pastry case and the coffee bar carry most orders, as in a real morning. */
const COMMON: readonly string[] = [
  "butter-croissant",
  "butter-croissant",
  "butter-croissant",
  "almond-croissant",
  "almond-croissant",
  "pain-au-chocolat",
  "pain-au-chocolat",
  "morning-bun",
  "cardamom-knot",
  "quiche-slice",
  "sourdough-loaf",
  "sourdough-loaf",
  "rye-loaf",
  "baguette",
  "drip-coffee",
  "drip-coffee",
  "oat-latte",
  "oat-latte",
];

const MAX_QTY: Record<string, number> = {
  "birthday-cake-6": 1,
  "sourdough-loaf": 2,
  "rye-loaf": 2,
  "baguette": 3,
  "quiche-slice": 2,
  "oat-latte": 2,
  "drip-coffee": 3,
};

for (let n = 0; n < TARGET_HISTORY_ORDERS; n++) {
  const residue = pick(DAY_WEIGHTS);
  const weeksBack = intBetween(0, Math.floor((HISTORY_WINDOW_DAYS - residue) / 7));
  const daysAgo = residue + weeksBack * 7;
  if (daysAgo < 1 || daysAgo > HISTORY_WINDOW_DAYS) continue;

  const isWeekend = residue === 0 || residue === 6;
  const lineCount = intBetween(1, isWeekend ? 3 : 2);
  const items = new Map<string, number>();

  for (let i = 0; i < lineCount; i++) {
    // A cake is a rare, deliberate purchase, so it never joins the random pastry mix.
    const productId = rng() < 0.01 ? "birthday-cake-6" : pick(COMMON);
    const cap = MAX_QTY[productId] ?? 4;
    items.set(productId, Math.min(cap, (items.get(productId) ?? 0) + intBetween(1, cap)));
  }

  orders.push({
    id: seededUuid(),
    customerId: pick(walkIns),
    kind: "history",
    daysAgo,
    pickupLocalTime: pick(isWeekend ? WEEKEND_TIMES : WEEKDAY_TIMES),
    items: [...items].map(([productId, qty]) => ({ productId, qty })),
  });
}

// ---------------------------------------------------------------------------
// Upcoming paid orders: the committed load the counteroffer is computed against.
// Butter croissants total 12 on Saturday and 6 on Sunday, so against a daily
// capacity of 36 there are 24 left Saturday and 30 left Sunday. Hand-written
// rather than generated, because the whole demo depends on these numbers.
// ---------------------------------------------------------------------------

const UPCOMING: { customer: string; pickupDay: "next_sat" | "next_sun"; at: string; items: SeedItem[] }[] = [
  {
    customer: "Dana Whitfield",
    pickupDay: "next_sat",
    at: "08:30",
    items: [
      { productId: "butter-croissant", qty: 6 },
      { productId: "drip-coffee", qty: 2 },
    ],
  },
  {
    customer: "Theo Marchetti",
    pickupDay: "next_sat",
    at: "09:30",
    items: [
      { productId: "butter-croissant", qty: 4 },
      { productId: "quiche-slice", qty: 1 },
    ],
  },
  {
    customer: "Aisha Bello",
    pickupDay: "next_sat",
    at: "10:00",
    items: [
      { productId: "butter-croissant", qty: 2 },
      { productId: "almond-croissant", qty: 3 },
    ],
  },
  {
    customer: "Grant Okafor",
    pickupDay: "next_sat",
    at: "11:00",
    items: [
      { productId: "sourdough-loaf", qty: 2 },
      { productId: "baguette", qty: 1 },
    ],
  },
  {
    customer: "Linnea Sorensen",
    pickupDay: "next_sat",
    at: "12:00",
    items: [{ productId: "birthday-cake-6", qty: 1 }],
  },
  {
    customer: "Marcus Ruiz",
    pickupDay: "next_sun",
    at: "09:00",
    items: [
      { productId: "butter-croissant", qty: 4 },
      { productId: "oat-latte", qty: 2 },
    ],
  },
  {
    customer: "Hana Kobayashi",
    pickupDay: "next_sun",
    at: "10:30",
    items: [
      { productId: "butter-croissant", qty: 2 },
      { productId: "sourdough-loaf", qty: 1 },
    ],
  },
  {
    customer: "Oscar Delgado",
    pickupDay: "next_sun",
    at: "11:00",
    items: [
      { productId: "pain-au-chocolat", qty: 2 },
      { productId: "morning-bun", qty: 2 },
    ],
  },
];

const byName = new Map(customers.map((c) => [c.name, c.id]));
for (const row of UPCOMING) {
  const customerId = byName.get(row.customer);
  if (!customerId) throw new Error(`data/seed/customers.json has no customer named "${row.customer}"`);
  orders.push({
    id: seededUuid(),
    customerId,
    kind: "upcoming",
    pickupDay: row.pickupDay,
    pickupLocalTime: row.at,
    items: row.items,
  });
}

// Oldest history first, then the upcoming orders, so a diff of this file stays readable.
orders.sort((a, b) => {
  if (a.kind !== b.kind) return a.kind === "history" ? -1 : 1;
  if (a.kind === "history" && b.kind === "history") return b.daysAgo - a.daysAgo;
  return 0;
});

writeFileSync(OUT, `${JSON.stringify(orders, null, 2)}\n`);

const history = orders.filter((o) => o.kind === "history");
const upcoming = orders.filter((o) => o.kind === "upcoming");
console.log(`wrote ${orders.length} orders to data/seed/orders.json`);
console.log(`  ${history.length} history, ${upcoming.length} upcoming`);
for (const key of ["maya", "jun", "priya", "elena"]) {
  const mine = history.filter((o) => o.customerId === persona(key));
  const last = Math.min(...mine.map((o) => (o.kind === "history" ? o.daysAgo : Infinity)));
  console.log(`  ${key}: ${mine.length} orders, last ${last} days ago`);
}
