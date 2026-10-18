/**
 * Loads data/seed into Supabase. Idempotent: every row upserts on a stable ID.
 * Order dates are relative, so reseed shortly before the demo (`pnpm reset --yes`).
 *
 *   pnpm seed
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { business } from "../apps/server/src/business.ts";
import { db } from "../apps/server/src/db.ts";
import { env, features } from "../apps/server/src/env.ts";
import { normalizeHandle } from "../apps/server/src/inbound.ts";
import { ensureSquareCustomer } from "../apps/server/src/square/customers.ts";
import { addDays, localDateOf, nextWeekday, zonedTime } from "../apps/server/src/time.ts";

interface SeedProduct { id: string; name: string; category: string; priceCents: number; dailyCapacity: number; aliases?: string[] }
interface SeedIngredient { id: string; name: string; unit: string; onHand: number; reorderPoint: number; supplier: string; unitCostCents: number }
interface SeedRecipe { productId: string; ingredientId: string; qtyPerUnit: number }
interface SeedCustomer { id: string; personaKey?: string; name: string; notes?: string }
type SeedOrder =
  | { id: string; customerId: string; kind: "history"; daysAgo: number; pickupLocalTime: string; items: { productId: string; qty: number }[] }
  | { id: string; customerId: string; kind: "upcoming"; pickupDay: "next_sat" | "next_sun"; pickupLocalTime: string; items: { productId: string; qty: number }[] };

// SEED_DIR lets the server's own tests seed from fixtures; the team always seeds from data/seed.
const SEED_DIR = process.env.SEED_DIR ? `${process.env.SEED_DIR.replace(/\/$/, "")}/` : fileURLToPath(new URL("../data/seed/", import.meta.url));
const FILES = ["products", "ingredients", "recipes", "customers", "orders"] as const;

function read<T>(name: (typeof FILES)[number]): T {
  return JSON.parse(readFileSync(`${SEED_DIR}${name}.json`, "utf8")) as T;
}

function check<T>(result: { error: { message: string } | null; data?: T }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
}

/** `maya=+12065550100,jun=+12065550101` → { maya: "+12065550100", ... }. Real numbers live only in .env. */
function personas(): Map<string, string> {
  const raw = process.env.DEMO_PERSONAS ?? "";
  return new Map(
    raw
      .split(",")
      .map((pair) => pair.split("=").map((s) => s.trim()))
      .filter((kv): kv is [string, string] => kv.length === 2 && Boolean(kv[0]) && Boolean(kv[1]))
      .map(([k, v]) => [k, normalizeHandle(v)]),
  );
}

async function chunked<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

/** Customer IDs the seed owns, so reset keeps them. Empty when the seed files don't exist yet. */
export function seedCustomerIds(): string[] {
  return existsSync(`${SEED_DIR}customers.json`) ? read<SeedCustomer[]>("customers").map((c) => c.id) : [];
}

/**
 * Upserts never remove anything, so a seed that drops a product (the bakery → coffee shop switch
 * dropped the breads and the cake) would leave it in the menu. This deletes what the seed files no
 * longer contain: history orders first (their items reference products), then recipe lines,
 * then products and ingredients. Agent orders are reset's job; a product one still uses is
 * deactivated instead of deleted.
 */
async function prune(products: SeedProduct[], ingredients: SeedIngredient[], recipes: SeedRecipe[], orders: SeedOrder[]) {
  const keepOrders = new Set(orders.map((o) => o.id));
  const keepProducts = new Set(products.map((p) => p.id));
  const keepIngredients = new Set(ingredients.map((i) => i.id));
  const keepRecipes = new Set(recipes.map((r) => `${r.productId}|${r.ingredientId}`));

  const history = check(await db().from("orders").select("id").eq("source", "history").limit(10_000), "list history orders") ?? [];
  const staleOrders = history.map((o) => o.id).filter((id) => !keepOrders.has(id));
  await chunked(staleOrders, 100, async (ids) => void check(await db().from("orders").delete().in("id", ids), "prune orders"));

  // Seeded orders keep their IDs when their items change, so drop item lines the seed no longer lists.
  const keepItems = new Set(orders.flatMap((o) => o.items.map((i) => `${o.id}|${i.productId}`)));
  const seededIds = [...keepOrders];
  let staleItems = 0;
  await chunked(seededIds, 100, async (ids) => {
    const items = check(await db().from("order_items").select("order_id, product_id").in("order_id", ids), "list order items") ?? [];
    for (const it of items.filter((it) => !keepItems.has(`${it.order_id}|${it.product_id}`))) {
      check(await db().from("order_items").delete().eq("order_id", it.order_id).eq("product_id", it.product_id), "prune order item");
      staleItems++;
    }
  });

  const lines = check(await db().from("recipe_lines").select("product_id, ingredient_id"), "list recipe lines") ?? [];
  for (const l of lines.filter((l) => !keepRecipes.has(`${l.product_id}|${l.ingredient_id}`))) {
    check(
      await db().from("recipe_lines").delete().eq("product_id", l.product_id).eq("ingredient_id", l.ingredient_id),
      "prune recipe line",
    );
  }

  const staleProducts = (check(await db().from("products").select("id"), "list products") ?? []).map((p) => p.id).filter((id) => !keepProducts.has(id));
  const deactivated: string[] = [];
  for (const id of staleProducts) {
    const { error } = await db().from("products").delete().eq("id", id);
    if (error?.code === "23503") {
      check(await db().from("products").update({ active: false }).eq("id", id), "deactivate product");
      deactivated.push(id);
    } else if (error) throw new Error(`prune product ${id}: ${error.message}`);
  }

  const staleIngredients = (check(await db().from("ingredients").select("id"), "list ingredients") ?? []).map((i) => i.id).filter((id) => !keepIngredients.has(id));
  if (staleIngredients.length) check(await db().from("ingredients").delete().in("id", staleIngredients), "prune ingredients");

  return {
    orders: staleOrders.length,
    orderItems: staleItems,
    products: staleProducts.filter((id) => !deactivated.includes(id)),
    deactivatedProducts: deactivated,
    ingredients: staleIngredients,
  };
}

export async function seed() {
  const missing = FILES.filter((f) => !existsSync(`${SEED_DIR}${f}.json`));
  if (missing.length) {
    throw new Error(`Seed data missing: data/seed/{${missing.join(",")}}.json. Lane 3 writes these (planning/LANE-3-AGENTS.md Phase 1).`);
  }
  const products = read<SeedProduct[]>("products");
  const ingredients = read<SeedIngredient[]>("ingredients");
  const recipes = read<SeedRecipe[]>("recipes");
  const customers = read<SeedCustomer[]>("customers");
  const orders = read<SeedOrder[]>("orders");
  const handles = personas();

  check(
    await db().from("products").upsert(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price_cents: p.priceCents,
        daily_capacity: p.dailyCapacity,
        aliases: p.aliases ?? [],
        active: true,
      })),
    ),
    "products",
  );
  check(
    await db().from("ingredients").upsert(
      ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        on_hand: i.onHand,
        on_order: 0,
        reorder_point: i.reorderPoint,
        supplier: i.supplier,
        unit_cost_cents: i.unitCostCents,
      })),
    ),
    "ingredients",
  );
  check(
    await db().from("recipe_lines").upsert(
      recipes.map((r) => ({ product_id: r.productId, ingredient_id: r.ingredientId, qty_per_unit: r.qtyPerUnit })),
    ),
    "recipe_lines",
  );

  // A persona's phone may sit on a leftover customer from testing; free it so the unique handle can move.
  const personaHandles = [...handles.values()];
  if (personaHandles.length) {
    const seedIds = customers.map((c) => c.id);
    check(
      await db().from("customers").update({ handle: null }).in("handle", personaHandles).not("id", "in", `(${seedIds.join(",")})`),
      "free persona handles",
    );
  }
  // The database is shared: a teammate seeding without DEMO_PERSONAS must not erase the persona
  // phones someone else set. So only customers whose number this machine knows get a handle written.
  const withPhone = customers.filter((c) => c.personaKey && handles.has(c.personaKey));
  const withoutPhone = customers.filter((c) => !withPhone.includes(c));
  if (withPhone.length) {
    check(
      await db().from("customers").upsert(
        withPhone.map((c) => ({ id: c.id, name: c.name, notes: c.notes ?? null, handle: handles.get(c.personaKey!)!, is_demo_persona: true })),
      ),
      "persona customers",
    );
  }
  check(
    await db().from("customers").upsert(withoutPhone.map((c) => ({ id: c.id, name: c.name, notes: c.notes ?? null }))),
    "customers",
  );

  const prices = new Map(products.map((p) => [p.id, p.priceCents]));
  const today = localDateOf(new Date(), business.timezone);
  const tz = business.timezone;
  const orderRows = orders.map((o) => {
    const total = o.items.reduce((sum, i) => sum + i.qty * (prices.get(i.productId) ?? 0), 0);
    if (o.kind === "history") {
      const pickupDate = addDays(today, -o.daysAgo);
      const pickup = zonedTime(pickupDate, o.pickupLocalTime, tz);
      const created = zonedTime(addDays(pickupDate, -1), o.pickupLocalTime, tz);
      return {
        id: o.id,
        customer_id: o.customerId,
        source: "history",
        status: "fulfilled",
        pickup_at: pickup.toISOString(),
        created_at: created.toISOString(),
        paid_at: created.toISOString(),
        total_cents: total,
      };
    }
    // next_sun is the Sunday of the same weekend as next_sat, even when seeding on a Saturday.
    const saturday = nextWeekday(today, "sat");
    const pickupDate = o.pickupDay === "next_sat" ? saturday : addDays(saturday, 1);
    const now = new Date().toISOString();
    return {
      id: o.id,
      customer_id: o.customerId,
      source: "history",
      status: "paid",
      pickup_at: zonedTime(pickupDate, o.pickupLocalTime, tz).toISOString(),
      created_at: now,
      paid_at: now,
      total_cents: total,
    };
  });
  await chunked(orderRows, 500, async (chunk) => void check(await db().from("orders").upsert(chunk), "orders"));
  const itemRows = orders.flatMap((o) =>
    o.items.map((i) => ({ order_id: o.id, product_id: i.productId, qty: i.qty, unit_price_cents: prices.get(i.productId) ?? 0 })),
  );
  await chunked(itemRows, 500, async (chunk) => void check(await db().from("order_items").upsert(chunk), "order_items"));

  const pruned = await prune(products, ingredients, recipes, orders);

  let squareCustomers = 0;
  if (features.square) {
    for (const c of customers) {
      const handle = c.personaKey ? handles.get(c.personaKey) : undefined;
      const squareId = await ensureSquareCustomer({ id: c.id, name: c.name, handle });
      check(await db().from("customers").update({ square_customer_id: squareId }).eq("id", c.id), "square_customer_id");
      squareCustomers++;
    }
  }

  const summary = {
    products: products.length,
    ingredients: ingredients.length,
    recipeLines: recipes.length,
    customers: customers.length,
    personasWithPhones: [...handles.keys()].filter((k) => customers.some((c) => c.personaKey === k)),
    orders: orders.length,
    pruned,
    squareCustomers: features.square ? squareCustomers : `skipped (Square not configured, ${env.SQUARE_ENVIRONMENT})`,
  };
  return summary;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  seed()
    .then((s) => console.log("Seeded:", s))
    .catch((err: Error) => {
      console.error(err.message);
      process.exit(1);
    });
}
