/**
 * An `AgentDataPort` over `data/seed/*.json`, in memory.
 *
 * Lets the whole pipeline run with no database and no server: `eval`, `chat`, and the
 * unit tests all go through here. It resolves the seed's relative dates (`daysAgo`,
 * `next_sat`, `next_sun`) against an injected `now`, exactly as lane 2's seed script
 * does at seed time, so fixture behaviour and live behaviour agree.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
  AgentDataPort,
  BusinessProfile,
  ConversationContext,
  CustomerProfile,
  DayLoad,
  IngredientNeed,
  OrderLine,
  OrderSummary,
  Product,
  RegularCadence,
} from "@boh/shared";
import { addDays, localDate, nextSaturdayAndSunday, openDaysAfter } from "../time.ts";

const seedFile = <T,>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../data/seed/${name}`, import.meta.url)), "utf8")) as T;

interface SeedProduct {
  id: string;
  name: string;
  category: Product["category"];
  priceCents: number;
  dailyCapacity: number;
  aliases: string[];
  active: boolean;
}
interface SeedIngredient {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  reorderPoint: number;
  supplier: string;
  unitCostCents: number;
}
interface SeedRecipeLine {
  productId: string;
  ingredientId: string;
  qtyPerUnit: number;
}
interface SeedCustomer {
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

/** A seed order with its relative dates resolved against `now`. */
interface MaterializedOrder {
  id: string;
  customerId: string;
  localDate: string;
  pickupLocal: string;
  status: OrderSummary["status"];
  items: SeedItem[];
}

export interface FixturePortOptions {
  now: Date;
  /** persona key or handle -> handle, so `getCustomerByHandle` can find demo personas. */
  handles?: Record<string, string>;
  /** Seeded into `getConversation`, for cases that need prior turns. */
  conversation?: ConversationContext;
}

export interface FixtureWorld {
  port: AgentDataPort;
  business: BusinessProfile;
  products: SeedProduct[];
  customers: SeedCustomer[];
  ingredients: SeedIngredient[];
  orders: MaterializedOrder[];
  /** The two days the counteroffer plays out on, resolved from `now`. */
  weekend: { sat: string; sun: string };
  personaId(key: string): string;
  priceOf(productId: string): number;
}

export function createFixtureWorld(options: FixturePortOptions): FixtureWorld {
  const business = seedFile<BusinessProfile>("business.json");
  const products = seedFile<SeedProduct[]>("products.json");
  const ingredients = seedFile<SeedIngredient[]>("ingredients.json");
  const recipes = seedFile<SeedRecipeLine[]>("recipes.json");
  const customers = seedFile<SeedCustomer[]>("customers.json");
  const seedOrders = seedFile<SeedOrder[]>("orders.json");

  const { now, handles = {} } = options;
  const today = localDate(now, business.timezone);
  const weekend = nextSaturdayAndSunday(today, business.timezone);

  const orders: MaterializedOrder[] = seedOrders.map((order) => {
    const date =
      order.kind === "history" ? addDays(today, -order.daysAgo) : order.pickupDay === "next_sat" ? weekend.sat : weekend.sun;
    return {
      id: order.id,
      customerId: order.customerId,
      localDate: date,
      pickupLocal: `${date}T${order.pickupLocalTime}`,
      // Lane 2's seed uses the same mapping: past orders are done, upcoming ones are paid.
      status: order.kind === "history" ? "fulfilled" : "paid",
      items: order.items,
    };
  });

  const product = (id: string): SeedProduct | undefined => products.find((p) => p.id === id);
  const priceOf = (id: string): number => product(id)?.priceCents ?? 0;

  const byPersona = new Map(customers.filter((c) => c.personaKey).map((c) => [c.personaKey as string, c]));
  const personaId = (key: string): string => {
    const hit = byPersona.get(key);
    if (!hit) throw new Error(`no persona "${key}" in data/seed/customers.json`);
    return hit.id;
  };

  const handleToCustomerId = new Map<string, string>();
  for (const [key, handle] of Object.entries(handles)) {
    const customer = byPersona.get(key);
    if (customer) handleToCustomerId.set(handle, customer.id);
  }

  const toProfile = (c: SeedCustomer): CustomerProfile => ({
    id: c.id,
    name: c.name,
    handle: Object.entries(handles).find(([key]) => byPersona.get(key)?.id === c.id)?.[1] ?? null,
    notes: c.notes ?? null,
    isDemoPersona: Boolean(c.personaKey),
  });

  const summarize = (order: MaterializedOrder): OrderSummary => ({
    id: order.id,
    createdAt: new Date(`${order.localDate}T12:00:00Z`).toISOString(),
    pickupAt: new Date(`${order.pickupLocal}:00Z`).toISOString(),
    status: order.status,
    totalCents: order.items.reduce((sum, i) => sum + priceOf(i.productId) * i.qty, 0),
    items: order.items.map((i) => ({
      productId: i.productId,
      name: product(i.productId)?.name ?? i.productId,
      qty: i.qty,
    })),
  });

  /** Units of each product already committed (awaiting payment or paid) on one local date. */
  const committedOn = (date: string): Map<string, number> => {
    const committed = new Map<string, number>();
    for (const order of orders) {
      if (order.localDate !== date) continue;
      if (order.status !== "paid" && order.status !== "awaiting_payment") continue;
      for (const item of order.items) {
        committed.set(item.productId, (committed.get(item.productId) ?? 0) + item.qty);
      }
    }
    return committed;
  };

  const dayLoad = (date: string): DayLoad[] => {
    const committed = committedOn(date);
    return products
      .filter((p) => p.active)
      .map((p) => ({ productId: p.id, committed: committed.get(p.id) ?? 0, capacity: p.dailyCapacity }));
  };

  /** Recipe expansion: how much of each ingredient a basket of products consumes. */
  const consume = (items: SeedItem[]): Map<string, number> => {
    const used = new Map<string, number>();
    for (const item of items) {
      for (const line of recipes.filter((r) => r.productId === item.productId)) {
        used.set(line.ingredientId, (used.get(line.ingredientId) ?? 0) + line.qtyPerUnit * item.qty);
      }
    }
    return used;
  };

  const port: AgentDataPort = {
    async getConversation(conversationId, limit = 20) {
      const seeded = options.conversation;
      if (seeded) return { ...seeded, messages: seeded.messages.slice(-limit) };
      return { id: conversationId, handle: "", customerId: null, messages: [] };
    },

    async getCustomer(customerId) {
      const hit = customers.find((c) => c.id === customerId);
      return hit ? toProfile(hit) : null;
    },

    async getCustomerByHandle(handle) {
      const id = handleToCustomerId.get(handle);
      if (!id) return null;
      const hit = customers.find((c) => c.id === id);
      return hit ? toProfile(hit) : null;
    },

    async getOrderHistory(customerId, limit = 12) {
      return orders
        .filter((o) => o.customerId === customerId && o.status === "fulfilled")
        .sort((a, b) => b.localDate.localeCompare(a.localDate))
        .slice(0, limit)
        .map(summarize);
    },

    async getCatalog() {
      return products
        .filter((p) => p.active)
        .map(
          (p): Product => ({
            id: p.id,
            name: p.name,
            category: p.category,
            priceCents: p.priceCents,
            dailyCapacity: p.dailyCapacity,
            aliases: p.aliases,
            active: p.active,
          }),
        );
    },

    async getDayLoad(date) {
      return dayLoad(date);
    },

    async getIngredientNeeds(items: OrderLine[], date) {
      // Contract: `need` is the requested items plus everything already committed that day.
      const requested = consume(items);
      const alreadyCommitted = consume(
        [...committedOn(date)].map(([productId, qty]) => ({ productId, qty })),
      );

      const touched = new Set([...requested.keys(), ...alreadyCommitted.keys()]);
      const needs: IngredientNeed[] = [];
      for (const ingredientId of touched) {
        const row = ingredients.find((i) => i.id === ingredientId);
        if (!row) continue;
        const need = (requested.get(ingredientId) ?? 0) + (alreadyCommitted.get(ingredientId) ?? 0);
        const onOrder = 0;
        needs.push({
          ingredientId,
          name: row.name,
          unit: row.unit,
          need,
          onHand: row.onHand,
          onOrder,
          shortfall: Math.max(0, need - row.onHand - onOrder),
          supplier: row.supplier,
          reorderPoint: row.reorderPoint,
          unitCostCents: row.unitCostCents,
        });
      }
      return needs.sort((a, b) => b.shortfall - a.shortfall || a.ingredientId.localeCompare(b.ingredientId));
    },

    async getPendingProposals() {
      return [];
    },

    async getNextOpenDays(date, count) {
      return openDaysAfter(date, count, business).map((localDate) => ({ localDate, load: dayLoad(localDate) }));
    },

    async getRegularCadences() {
      const cadences: RegularCadence[] = [];
      for (const customer of customers) {
        const theirs = orders
          .filter((o) => o.customerId === customer.id && o.status === "fulfilled")
          .map((o) => o.localDate)
          .sort((a, b) => b.localeCompare(a));
        if (theirs.length < 2) continue;

        const dayNumber = (d: string): number => Math.round(new Date(`${d}T12:00:00Z`).getTime() / 86_400_000);
        const gaps = theirs.slice(1).map((d, i) => dayNumber(theirs[i] as string) - dayNumber(d));
        const sorted = [...gaps].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median =
          sorted.length % 2 === 1
            ? (sorted[mid] as number)
            : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;

        // The injected conversation is this customer's: they are mid-conversation now.
        const inConversation = options.conversation
          ? handleToCustomerId.get(options.conversation.handle) === customer.id
          : false;

        cadences.push({
          customerId: customer.id,
          name: customer.name,
          orderCount: theirs.length,
          medianIntervalDays: median,
          daysSinceLast: dayNumber(today) - dayNumber(theirs[0] as string),
          // Only personas with a handle have a Photon space the line could reply into.
          hasOpenConversation: [...handleToCustomerId.values()].includes(customer.id),
          ...(inConversation ? { daysSinceLastContact: 0 } : {}),
        });
      }
      return cadences;
    },
  };

  return { port, business, products, customers, ingredients, orders, weekend, personaId, priceOf };
}
