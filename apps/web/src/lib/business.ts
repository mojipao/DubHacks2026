import type { BusinessProfile } from "@boh/shared";
import businessJson from "../../../../data/seed/business.json";
import ingredientsJson from "../../../../data/seed/ingredients.json";
import productsJson from "../../../../data/seed/products.json";

/** Read from lane 3's seed at build time, so the UI and the agents agree on the shop. */
export const BUSINESS = businessJson as BusinessProfile;

/**
 * Display name for chrome and join pages.
 * Demo shop is Yemeni Coffee (UI brand). Seed may still say Kettle & Crow until data catches up.
 */
export const SHOP_NAME = "Yemeni Coffee";

/** Short mark for the top bar — same as the shop name unless a longer legal form lands later. */
export const BRAND_SHORT = SHOP_NAME;

// The coffee menu lane 2 is landing in data/seed (docs/handoff/coffee-shop). Seed values win once they exist.
const COFFEE_MENU: { id: string; name: string; priceCents: number }[] = [
  { id: "cappuccino", name: "Cappuccino", priceCents: 575 },
  { id: "cold-brew", name: "Cold brew", priceCents: 525 },
  { id: "mocha", name: "Mocha", priceCents: 625 },
  { id: "coffee-box", name: "Coffee box (serves 12)", priceCents: 3600 },
  { id: "house-beans", name: "House espresso beans, 12 oz bag", priceCents: 1800 },
];

export const PRODUCT_NAMES: Record<string, string> = Object.fromEntries([
  ...COFFEE_MENU.map((p) => [p.id, p.name]),
  ...productsJson.map((p) => [p.id, p.name]),
]);

export const PRODUCT_PRICES: Record<string, number> = Object.fromEntries([
  ...COFFEE_MENU.map((p) => [p.id, p.priceCents]),
  ...productsJson.map((p) => [p.id, p.priceCents]),
]);

export const INGREDIENT_NAMES: Record<string, { name: string; unit: string }> =
  Object.fromEntries(
    ingredientsJson.map((i) => [i.id, { name: i.name, unit: i.unit }]),
  );

export const INGREDIENT_COSTS: Record<string, number> = Object.fromEntries(
  ingredientsJson.map((i) => [i.id, i.unitCostCents]),
);
