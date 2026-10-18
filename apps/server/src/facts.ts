import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** What the shop says about each item: size, ingredients, allergens. Read by the order check-in and the phone agent. */
export interface ProductFacts {
  size: string;
  description: string;
  ingredients: string[];
  allergens: string[];
}

const PATH = fileURLToPath(new URL("../../../data/seed/product-facts.json", import.meta.url));

export const productFacts: Record<string, ProductFacts> = existsSync(PATH)
  ? (JSON.parse(readFileSync(PATH, "utf8")) as Record<string, ProductFacts>)
  : {};

/** Allergy words a customer's notes use, mapped to the allergen names in the facts file. */
const ALLERGY_WORDS: [RegExp, string][] = [
  [/\b(tree[\s-]?nut|nut|pistachio|almond|walnut|cashew)s?\b/i, "tree nuts"],
  [/\b(dairy|milk|lactose)\b/i, "milk"],
  [/\b(gluten|wheat|celiac|coeliac)\b/i, "wheat"],
  [/\bsesame\b/i, "sesame"],
  [/\beggs?\b/i, "eggs"],
];

/** The allergens a customer's notes declare, e.g. "Tree nut allergy (mentioned 2026-09)" → ["tree nuts"]. */
export function declaredAllergies(notes: string | null | undefined): string[] {
  if (!notes || !/allerg|intoleran|celiac|coeliac|can'?t have|cannot eat/i.test(notes)) return [];
  return ALLERGY_WORDS.filter(([re]) => re.test(notes)).map(([, name]) => name);
}

/** Does this product contain the allergen (matched on the facts' allergen labels)? */
export function contains(productId: string, allergen: string): boolean {
  const key = allergen.replace(/s$/, "").split(" ")[0]!.toLowerCase();
  return (productFacts[productId]?.allergens ?? []).some((a) => a.toLowerCase().includes(key));
}
