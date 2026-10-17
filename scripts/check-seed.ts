/**
 * Asserts that the synthetic bakery adds up. Run after any change to `data/seed/**`:
 *
 *   pnpm tsx scripts/check-seed.ts
 *
 * The demo's second beat ("we can't do 48 Saturday: 24 Sat + 24 Sun, and here's the
 * butter reorder") only lands if the capacity and stock numbers are exactly right.
 * Every number the pitch says out loud is checked here, so a later tweak to a recipe
 * or an upcoming order fails loudly instead of quietly flattening the counteroffer.
 *
 * Exits non-zero on the first failing group, with the computed numbers printed.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Type-only, by path: the repo root does not depend on @boh/shared (that is lane 2's
// package.json), and this keeps BusinessProfile a single source of truth anyway.
import type { BusinessProfile } from "../packages/shared/src/index.ts";

const read = <T,>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../data/seed/${name}`, import.meta.url)), "utf8")) as T;

interface Product {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  dailyCapacity: number;
  aliases: string[];
  active: boolean;
}
interface Ingredient {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  reorderPoint: number;
  supplier: string;
  unitCostCents: number;
}
interface RecipeLine {
  productId: string;
  ingredientId: string;
  qtyPerUnit: number;
}
interface Customer {
  id: string;
  personaKey?: string;
  name: string;
  notes?: string;
}
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

const business = read<BusinessProfile>("business.json");
const products = read<Product[]>("products.json");
const ingredients = read<Ingredient[]>("ingredients.json");
const recipes = read<RecipeLine[]>("recipes.json");
const customers = read<Customer[]>("customers.json");
const orders = read<SeedOrder[]>("orders.json");

const product = (id: string): Product => {
  const hit = products.find((p) => p.id === id);
  if (!hit) throw new Error(`no product ${id}`);
  return hit;
};
const ingredient = (id: string): Ingredient => {
  const hit = ingredients.find((i) => i.id === id);
  if (!hit) throw new Error(`no ingredient ${id}`);
  return hit;
};
const persona = (key: string): Customer => {
  const hit = customers.find((c) => c.personaKey === key);
  if (!hit) throw new Error(`no persona ${key}`);
  return hit;
};

const history = orders.filter((o): o is Extract<SeedOrder, { kind: "history" }> => o.kind === "history");
const upcoming = orders.filter((o): o is Extract<SeedOrder, { kind: "upcoming" }> => o.kind === "upcoming");

const BUTTER_CROISSANT = "butter-croissant";
const butterPerCroissant = recipes.find(
  (r) => r.productId === BUTTER_CROISSANT && r.ingredientId === "butter",
)?.qtyPerUnit;

/** Units of one product committed on one of the two upcoming days. */
function committedUnits(productId: string, day: "next_sat" | "next_sun"): number {
  return upcoming
    .filter((o) => o.pickupDay === day)
    .flatMap((o) => o.items)
    .filter((i) => i.productId === productId)
    .reduce((sum, i) => sum + i.qty, 0);
}

/** How much of one ingredient a basket of items consumes, through the recipe table. */
function ingredientNeed(items: SeedItem[], ingredientId: string): number {
  return items.reduce((sum, item) => {
    const line = recipes.find((r) => r.productId === item.productId && r.ingredientId === ingredientId);
    return sum + (line ? line.qtyPerUnit * item.qty : 0);
  }, 0);
}

const committedItems = (day?: "next_sat" | "next_sun"): SeedItem[] =>
  upcoming.filter((o) => (day ? o.pickupDay === day : true)).flatMap((o) => o.items);

const failures: string[] = [];
const notes: string[] = [];
let groups = 0;

function group(name: string, body: () => void): void {
  groups++;
  const before = failures.length;
  try {
    body();
  } catch (error) {
    failures.push(`${name}: threw ${error instanceof Error ? error.message : String(error)}`);
  }
  const added = failures.length - before;
  console.log(`${added === 0 ? "  ✓" : "  ✗"} ${name}`);
}

function check(label: string, condition: boolean, detail: string): void {
  if (!condition) failures.push(`${label} — ${detail}`);
}

console.log(`\nchecking data/seed for ${business.name}\n`);

group("referential integrity", () => {
  const productIds = new Set(products.map((p) => p.id));
  const ingredientIds = new Set(ingredients.map((i) => i.id));
  const customerIds = new Set(customers.map((c) => c.id));

  for (const r of recipes) {
    check("recipes.productId", productIds.has(r.productId), `unknown product "${r.productId}"`);
    check("recipes.ingredientId", ingredientIds.has(r.ingredientId), `unknown ingredient "${r.ingredientId}"`);
  }
  for (const o of orders) {
    check("orders.customerId", customerIds.has(o.customerId), `order ${o.id} has unknown customer`);
    for (const i of o.items) {
      check("orders.items.productId", productIds.has(i.productId), `order ${o.id} has unknown product "${i.productId}"`);
      check("orders.items.qty", Number.isInteger(i.qty) && i.qty > 0, `order ${o.id} has qty ${i.qty}`);
    }
  }
  check("customers unique", new Set(customers.map((c) => c.id)).size === customers.length, "duplicate customer id");
  check("orders unique", new Set(orders.map((o) => o.id)).size === orders.length, "duplicate order id");
  check(
    "every product is sellable",
    products.every((p) => p.priceCents > 0 && p.dailyCapacity > 0),
    "a product has zero price or capacity",
  );
});

group("the capacity table in planning/LANE-3-AGENTS.md Phase 1", () => {
  const capacity = product(BUTTER_CROISSANT).dailyCapacity;
  const sat = committedUnits(BUTTER_CROISSANT, "next_sat");
  const sun = committedUnits(BUTTER_CROISSANT, "next_sun");

  check("butter croissant capacity", capacity === 36, `expected 36 per day, found ${capacity}`);
  check("Saturday committed", sat === 12, `expected 12, found ${sat}`);
  check("Sunday committed", sun === 6, `expected 6, found ${sun}`);
  check("Saturday remaining", capacity - sat === 24, `expected 24 left, found ${capacity - sat}`);
  check("Sunday remaining", capacity - sun === 30, `expected 30 left, found ${capacity - sun}`);
  check("almond croissant capacity", product("almond-croissant").dailyCapacity === 48, "expected 48 per day");
  check("birthday cake capacity", product("birthday-cake-6").dailyCapacity === 4, "expected 4 per day");

  notes.push(`butter croissants: Sat ${sat}/${capacity} committed (${capacity - sat} left) · Sun ${sun}/${capacity} (${capacity - sun} left)`);
});

group("no upcoming day is already over capacity", () => {
  for (const day of ["next_sat", "next_sun"] as const) {
    for (const p of products) {
      const committed = committedUnits(p.id, day);
      check(
        `${day} ${p.id}`,
        committed <= p.dailyCapacity,
        `${committed} committed exceeds capacity ${p.dailyCapacity}`,
      );
    }
  }
});

group("butter is the binding constraint on 4 dozen croissants", () => {
  const butter = ingredient("butter");
  check("butter recipe line exists", butterPerCroissant !== undefined, "no butter line for butter-croissant");
  if (butterPerCroissant === undefined) return;

  const committedBoth = ingredientNeed(committedItems(), "butter");
  const headroom = butter.onHand - committedBoth;
  const headroomCroissants = headroom / butterPerCroissant;

  // "Butter on hand: enough for about 30 more croissants across both days, on top of committed orders."
  check(
    "headroom is about 30 croissants",
    headroomCroissants >= 29 && headroomCroissants <= 32,
    `${headroomCroissants.toFixed(1)} croissants of headroom (${headroom.toFixed(3)} ${butter.unit})`,
  );

  // Step 4 of the pipeline checks the request *as asked*: 48 on Saturday, plus Saturday's committed load.
  const asAsked = ingredientNeed([{ productId: BUTTER_CROISSANT, qty: 48 }], "butter") +
    ingredientNeed(committedItems("next_sat"), "butter");
  check(
    "48 on Saturday trips ingredient_shortfall",
    asAsked > butter.onHand,
    `needs ${asAsked.toFixed(3)} ${butter.unit}, on hand ${butter.onHand}`,
  );

  // Step 5 keeps the 24 + 24 plan and covers the gap with a reorder, measured across both days.
  const splitPlan = committedBoth + ingredientNeed([{ productId: BUTTER_CROISSANT, qty: 48 }], "butter");
  const shortfall = splitPlan - butter.onHand;
  check("the 24 + 24 plan still needs a reorder", shortfall > 0, `shortfall ${shortfall.toFixed(3)} ${butter.unit}`);
  check("butter comes from Rainier Dairy", butter.supplier === "Rainier Dairy", `supplier is ${butter.supplier}`);

  // planReorder: shortfall + topping back to the reorder point, rounded up to a whole supplier unit.
  const reorderQty = Math.ceil(shortfall + butter.reorderPoint);
  const reorderCents = reorderQty * butter.unitCostCents;
  check(
    "the reorder is the $38.40 in planning/ARCHITECTURE.md",
    reorderCents === 3840,
    `${reorderQty} ${butter.unit} x ${butter.unitCostCents}c = ${reorderCents}c`,
  );

  notes.push(`butter: ${butter.onHand} ${butter.unit} on hand, ${committedBoth.toFixed(3)} committed, ${headroomCroissants.toFixed(1)} croissants of headroom`);
  notes.push(`48 croissants short by ${shortfall.toFixed(3)} ${butter.unit} → reorder ${reorderQty} ${butter.unit} ($${(reorderCents / 100).toFixed(2)})`);
});

group("Maya's usual is comfortably in stock and does not rescue Jun", () => {
  const usual: SeedItem[] = [
    { productId: "almond-croissant", qty: 2 },
    { productId: "oat-latte", qty: 1 },
  ];

  for (const item of usual) {
    const left = product(item.productId).dailyCapacity - committedUnits(item.productId, "next_sat");
    check(`${item.productId} capacity for Maya`, left >= item.qty, `only ${left} left on Saturday`);
  }

  for (const ing of ingredients) {
    const need = ingredientNeed([...committedItems(), ...usual], ing.id);
    check(`${ing.id} covers Maya's usual`, need <= ing.onHand, `needs ${need.toFixed(3)}, on hand ${ing.onHand}`);
  }

  // planning/LANE-3-AGENTS.md warns that butter is shared, so Maya's order must not flip Jun's shortfall.
  if (butterPerCroissant !== undefined) {
    const butter = ingredient("butter");
    const afterMaya = butter.onHand - ingredientNeed([...committedItems(), ...usual], "butter");
    const junNeeds = ingredientNeed([{ productId: BUTTER_CROISSANT, qty: 48 }], "butter");
    check(
      "Jun is still short after Maya's order",
      afterMaya < junNeeds,
      `${afterMaya.toFixed(3)} left vs ${junNeeds.toFixed(3)} needed`,
    );
  }
});

group("the demo prices the pitch says out loud", () => {
  check("butter croissant is $4.50", product(BUTTER_CROISSANT).priceCents === 450, "48 of them must total $216.00");
  check(
    "48 butter croissants total $216.00",
    48 * product(BUTTER_CROISSANT).priceCents === 21600,
    "planning/ARCHITECTURE.md quotes $216.00 in the owner notification",
  );
  const mayaTotal = 2 * product("almond-croissant").priceCents + product("oat-latte").priceCents;
  check("Maya's usual is $18.50", mayaTotal === 1850, `found ${mayaTotal}c; the demo script says $18.50`);
  check("sourdough is $9 a loaf", product("sourdough-loaf").priceCents === 900, "quoted in the Guard decline example");
});

group("personas", () => {
  const counts = { maya: 14, jun: 2, priya: 2, elena: 7 };
  for (const [key, expected] of Object.entries(counts)) {
    const mine = history.filter((o) => o.customerId === persona(key).id);
    check(`${key} order count`, mine.length === expected, `expected ${expected}, found ${mine.length}`);
  }

  const mayaOrders = history
    .filter((o) => o.customerId === persona("maya").id)
    .sort((a, b) => a.daysAgo - b.daysAgo);
  const mayaLast = mayaOrders[0]?.daysAgo ?? -1;
  check("Maya is past the perk window", mayaLast > business.welcomeBackAfterDays, `last order ${mayaLast} days ago`);

  // The evidence chip claims "9 of last 12" are the usual, so the data has to back it.
  const isUsual = (o: (typeof mayaOrders)[number]): boolean => {
    const almond = o.items.find((i) => i.productId === "almond-croissant");
    const latte = o.items.find((i) => i.productId === "oat-latte");
    return o.items.length === 2 && almond?.qty === 2 && latte?.qty === 1;
  };
  const usualInLast12 = mayaOrders.slice(0, 12).filter(isUsual).length;
  check("Maya's usual is 9 of her last 12", usualInLast12 === 9, `found ${usualInLast12} of 12`);

  const junLast = Math.min(...history.filter((o) => o.customerId === persona("jun").id).map((o) => o.daysAgo));
  check(
    "Jun gets no welcome-back perk",
    junLast <= business.welcomeBackAfterDays,
    `last order ${junLast} days ago, perk window ${business.welcomeBackAfterDays}`,
  );
  const junUnits = history
    .filter((o) => o.customerId === persona("jun").id)
    .map((o) => o.items.reduce((s, i) => s + i.qty, 0));
  check(
    "Jun's history reads as catering",
    junUnits.every((u) => u >= business.cateringThresholdUnits),
    `order sizes ${junUnits.join(", ")} against threshold ${business.cateringThresholdUnits}`,
  );

  const priya = persona("priya");
  check("Priya's allergy is on her record", /allergy/i.test(priya.notes ?? ""), "notes do not mention an allergy");
  const priyaAlmond = history
    .filter((o) => o.customerId === priya.id)
    .some((o) => o.items.some((i) => i.productId.includes("almond")));
  check("Priya has never ordered almond", !priyaAlmond, "her history contains an almond item");
});

group("Elena qualifies for the win-back scan", () => {
  const elena = persona("elena");
  const days = history
    .filter((o) => o.customerId === elena.id)
    .map((o) => o.daysAgo)
    .sort((a, b) => a - b);

  const intervals = days.slice(1).map((d, i) => d - (days[i] as number));
  const sorted = [...intervals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  const daysSinceLast = days[0] as number;

  check(
    "enough orders to count as a regular",
    days.length >= business.winbackMinOrders,
    `${days.length} orders against winbackMinOrders ${business.winbackMinOrders}`,
  );
  // The plan's original numbers tied exactly (35 vs 35) and "exceeds" made it fail, so clear it with room.
  check(
    "overdue by more than the factor",
    daysSinceLast > business.winbackOverdueFactor * median,
    `${daysSinceLast} days since last vs ${business.winbackOverdueFactor} x ${median} = ${business.winbackOverdueFactor * median}`,
  );

  notes.push(`Elena: ${days.length} orders, median interval ${median}d, ${daysSinceLast}d since last (${(daysSinceLast / median).toFixed(1)}x overdue)`);

  // Maya is more overdue by ratio, so ranking by ratio alone picks the wrong persona.
  const mayaDays = history
    .filter((o) => o.customerId === persona("maya").id)
    .map((o) => o.daysAgo)
    .sort((a, b) => a - b);
  const mayaIntervals = mayaDays.slice(1).map((d, i) => d - (mayaDays[i] as number));
  const mayaMedian = [...mayaIntervals].sort((a, b) => a - b)[Math.floor(mayaIntervals.length / 2)] as number;
  const mayaRatio = (mayaDays[0] as number) / mayaMedian;
  if (mayaRatio > daysSinceLast / median) {
    notes.push(
      `heads up: Maya is ${mayaRatio.toFixed(1)}x overdue vs Elena's ${(daysSinceLast / median).toFixed(1)}x, ` +
        "so winback.ts must exclude customers contacted in the last 7 days rather than rank by ratio alone",
    );
  }
});

group("history shape", () => {
  check("about 400 history orders", history.length >= 380 && history.length <= 440, `found ${history.length}`);
  check("every history order is in the past", history.every((o) => o.daysAgo >= 1), "found daysAgo < 1");

  // Walk-in history stays inside the 120-day window; persona histories may reach further back.
  const personaIds = new Set(customers.filter((c) => c.personaKey).map((c) => c.id));
  const walkIn = history.filter((o) => !personaIds.has(o.customerId));
  check(
    "walk-in history stays inside 120 days",
    walkIn.every((o) => o.daysAgo <= 120),
    `oldest walk-in is ${Math.max(...walkIn.map((o) => o.daysAgo))} days ago`,
  );

  // Assuming a Saturday seed, daysAgo % 7 === 5 would be a Monday, when the shop is closed.
  const mondays = history.filter((o) => o.daysAgo % 7 === 5);
  check("nothing lands on a closed Monday", mondays.length === 0, `${mondays.length} orders at daysAgo % 7 === 5`);

  const weekdayFor = ["sat", "fri", "thu", "wed", "tue", "mon", "sun"] as const;
  for (const o of history) {
    const day = weekdayFor[o.daysAgo % 7] as keyof BusinessProfile["hours"];
    const hours = business.hours[day];
    if (!hours) continue;
    check(
      `pickup time inside hours (${day})`,
      o.pickupLocalTime >= hours.open && o.pickupLocalTime <= hours.close,
      `order ${o.id} at ${o.pickupLocalTime}, ${day} is ${hours.open}-${hours.close}`,
    );
  }

  const satHours = business.hours.sat;
  const sunHours = business.hours.sun;
  for (const o of upcoming) {
    const hours = o.pickupDay === "next_sat" ? satHours : sunHours;
    check(
      "upcoming pickup inside hours",
      Boolean(hours) && o.pickupLocalTime >= hours!.open && o.pickupLocalTime <= hours!.close,
      `order ${o.id} at ${o.pickupLocalTime}`,
    );
  }

  const weekend = history.filter((o) => o.daysAgo % 7 === 0 || o.daysAgo % 7 === 6).length;
  check(
    "weekends carry the peak without swallowing the week",
    weekend / history.length > 0.35 && weekend / history.length < 0.6,
    `${((weekend / history.length) * 100).toFixed(0)}% of orders fall on a weekend`,
  );
  notes.push(`${history.length} history orders, ${((weekend / history.length) * 100).toFixed(0)}% on weekends, ${upcoming.length} upcoming`);
});

group("no personal data in data/seed", () => {
  const raw = ["business.json", "products.json", "ingredients.json", "recipes.json", "customers.json", "orders.json"]
    .map((name) => readFileSync(fileURLToPath(new URL(`../data/seed/${name}`, import.meta.url)), "utf8"))
    .join("\n");

  check("no E.164 phone numbers", !/\+[1-9]\d{9,14}/.test(raw), "a phone number is in the seed data");
  check("no 10-digit phone numbers", !/\b\d{3}[-.]\d{3}[-.]\d{4}\b/.test(raw), "a phone number is in the seed data");
  check("no email addresses", !/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(raw), "an email address is in the seed data");
  check("no customer handles", !customers.some((c) => "handle" in c), "handles belong in DEMO_PERSONAS, not here");
});

console.log("");
for (const note of notes) console.log(`  · ${note}`);

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed check${failures.length === 1 ? "" : "s"}:\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error("");
  process.exit(1);
}

console.log(`\n✓ ${groups} groups passed. The counteroffer, the perk, and the win-back all have the data they need.\n`);
