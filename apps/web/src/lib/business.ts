import type { BusinessProfile } from "@boh/shared";
import businessJson from "../../../../data/seed/business.json";
import ingredientsJson from "../../../../data/seed/ingredients.json";
import productsJson from "../../../../data/seed/products.json";

/** Read from lane 3's seed at build time, so the UI and the agents agree on the shop. */
export const BUSINESS = businessJson as BusinessProfile;

export const PRODUCT_NAMES: Record<string, string> = Object.fromEntries(
  productsJson.map((p) => [p.id, p.name]),
);

export const PRODUCT_PRICES: Record<string, number> = Object.fromEntries(
  productsJson.map((p) => [p.id, p.priceCents]),
);

export const INGREDIENT_NAMES: Record<string, { name: string; unit: string }> =
  Object.fromEntries(
    ingredientsJson.map((i) => [i.id, { name: i.name, unit: i.unit }]),
  );

export const INGREDIENT_COSTS: Record<string, number> = Object.fromEntries(
  ingredientsJson.map((i) => [i.id, i.unitCostCents]),
);
