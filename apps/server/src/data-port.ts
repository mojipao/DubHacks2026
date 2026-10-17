import type {
  AgentDataPort,
  ConversationContext,
  CustomerProfile,
  DayLoad,
  IngredientNeed,
  OrderLine,
  OrderSummary,
  Product,
  RegularCadence,
  Tables,
} from "@boh/shared";
import { business } from "./business.ts";
import { db } from "./db.ts";
import { addDays, dayBounds, weekdayOf } from "./time.ts";

const DAY_MS = 86_400_000;
const COMMITTED = ["awaiting_payment", "paid"];

function toCustomer(row: Tables<"customers">): CustomerProfile {
  return { id: row.id, name: row.name, handle: row.handle, notes: row.notes, isDemoPersona: row.is_demo_persona };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

async function getDayLoad(localDate: string): Promise<DayLoad[]> {
  const [start, end] = dayBounds(localDate, business.timezone);
  const [{ data: products, error: pErr }, { data: orders, error: oErr }] = await Promise.all([
    db().from("products").select("id, daily_capacity").eq("active", true),
    db()
      .from("orders")
      .select("order_items(product_id, qty)")
      .in("status", COMMITTED)
      .gte("pickup_at", start)
      .lt("pickup_at", end),
  ]);
  if (pErr) throw new Error(`getDayLoad products: ${pErr.message}`);
  if (oErr) throw new Error(`getDayLoad orders: ${oErr.message}`);
  const committed = new Map<string, number>();
  for (const order of orders ?? []) {
    for (const item of order.order_items) committed.set(item.product_id, (committed.get(item.product_id) ?? 0) + item.qty);
  }
  return (products ?? []).map((p) => ({ productId: p.id, committed: committed.get(p.id) ?? 0, capacity: p.daily_capacity }));
}

/** Read-only view of the business for agents. */
export const supabaseDataPort: AgentDataPort = {
  async getConversation(conversationId, limit = 20) {
    const { data: conv, error } = await db().from("conversations").select("*").eq("id", conversationId).single();
    if (error) throw new Error(`getConversation: ${error.message}`);
    const { data: rows, error: msgError } = await db()
      .from("messages")
      .select("id, direction, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (msgError) throw new Error(`getConversation messages: ${msgError.message}`);
    const messages: ConversationContext["messages"] = (rows ?? []).reverse().map((m) => ({
      id: m.id,
      direction: m.direction as "inbound" | "outbound",
      body: m.body,
      createdAt: m.created_at,
    }));
    return { id: conv.id, handle: conv.handle, customerId: conv.customer_id, messages };
  },

  async getCustomer(customerId) {
    const { data } = await db().from("customers").select("*").eq("id", customerId).maybeSingle();
    return data ? toCustomer(data) : null;
  },

  async getCustomerByHandle(handle) {
    const { data } = await db().from("customers").select("*").eq("handle", handle).maybeSingle();
    return data ? toCustomer(data) : null;
  },

  async getCatalog() {
    const { data, error } = await db().from("products").select("*").eq("active", true);
    if (error) throw new Error(`getCatalog: ${error.message}`);
    return (data ?? []).map(
      (p): Product => ({
        id: p.id,
        name: p.name,
        category: p.category as Product["category"],
        priceCents: p.price_cents,
        dailyCapacity: p.daily_capacity,
        aliases: p.aliases,
        active: p.active,
      }),
    );
  },

  async getPendingProposals(conversationId) {
    const { data, error } = await db()
      .from("proposals")
      .select("id, kind, summary")
      .eq("conversation_id", conversationId)
      .eq("status", "pending");
    if (error) throw new Error(`getPendingProposals: ${error.message}`);
    return (data ?? []).map((p) => ({ id: p.id, kind: p.kind as "reply" | "reorder", summary: p.summary }));
  },

  async getOrderHistory(customerId, limit = 12) {
    const { data, error } = await db()
      .from("orders")
      .select("id, created_at, pickup_at, status, total_cents, order_items(product_id, qty, products(name))")
      .eq("customer_id", customerId)
      .order("pickup_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`getOrderHistory: ${error.message}`);
    return (data ?? []).map(
      (o): OrderSummary => ({
        id: o.id,
        createdAt: o.created_at,
        pickupAt: o.pickup_at,
        status: o.status as OrderSummary["status"],
        totalCents: o.total_cents,
        items: o.order_items.map((i) => ({ productId: i.product_id, name: i.products?.name ?? i.product_id, qty: i.qty })),
      }),
    );
  },

  getDayLoad,

  /** Everything the day already needs plus the requested items, against on hand + on order. */
  async getIngredientNeeds(items: OrderLine[], localDate: string) {
    const units = new Map<string, number>();
    for (const l of await getDayLoad(localDate)) if (l.committed) units.set(l.productId, l.committed);
    for (const i of items) units.set(i.productId, (units.get(i.productId) ?? 0) + i.qty);
    if (!units.size) return [];

    const { data: lines, error } = await db()
      .from("recipe_lines")
      .select("product_id, qty_per_unit, ingredients(id, name, unit, on_hand, on_order, supplier)")
      .in("product_id", [...units.keys()]);
    if (error) throw new Error(`getIngredientNeeds: ${error.message}`);

    const needs = new Map<string, IngredientNeed>();
    for (const line of lines ?? []) {
      const ing = line.ingredients;
      if (!ing) continue;
      const need = needs.get(ing.id) ?? {
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit,
        need: 0,
        onHand: Number(ing.on_hand),
        onOrder: Number(ing.on_order),
        shortfall: 0,
        supplier: ing.supplier,
      };
      need.need += (units.get(line.product_id) ?? 0) * Number(line.qty_per_unit);
      needs.set(ing.id, need);
    }
    return [...needs.values()].map((n) => ({
      ...n,
      need: Math.round(n.need * 1000) / 1000,
      shortfall: Math.max(0, Math.round((n.need - n.onHand - n.onOrder) * 1000) / 1000),
    }));
  },

  async getNextOpenDays(localDate, count) {
    const days: string[] = [];
    for (let i = 1; days.length < count && i <= 14; i++) {
      const candidate = addDays(localDate, i);
      if (business.hours[weekdayOf(candidate)]) days.push(candidate);
    }
    return Promise.all(days.map(async (d) => ({ localDate: d, load: await getDayLoad(d) })));
  },

  /** Cadence from past pickups only, so this weekend's upcoming orders don't count as "last order". */
  async getRegularCadences() {
    const now = new Date();
    const [{ data: orders, error }, { data: customers }, { data: convs }] = await Promise.all([
      db()
        .from("orders")
        .select("customer_id, pickup_at")
        .neq("status", "cancelled")
        .lte("pickup_at", now.toISOString())
        .not("customer_id", "is", null)
        .order("pickup_at")
        .limit(10_000),
      db().from("customers").select("id, name"),
      db().from("conversations").select("customer_id").eq("platform", "imessage").not("photon_space_id", "is", null),
    ]);
    if (error) throw new Error(`getRegularCadences: ${error.message}`);

    const byCustomer = new Map<string, number[]>();
    for (const o of orders ?? []) {
      const list = byCustomer.get(o.customer_id!) ?? [];
      list.push(Date.parse(o.pickup_at));
      byCustomer.set(o.customer_id!, list);
    }
    const names = new Map((customers ?? []).map((c) => [c.id, c.name]));
    const reachable = new Set((convs ?? []).map((c) => c.customer_id));

    const cadences: RegularCadence[] = [];
    for (const [customerId, times] of byCustomer) {
      if (times.length < business.winbackMinOrders) continue;
      const gaps = times.slice(1).map((t, i) => (t - times[i]!) / DAY_MS);
      cadences.push({
        customerId,
        name: names.get(customerId) ?? "Unknown",
        orderCount: times.length,
        medianIntervalDays: Math.round(median(gaps) * 10) / 10,
        daysSinceLast: Math.floor((now.getTime() - times.at(-1)!) / DAY_MS),
        hasOpenConversation: reachable.has(customerId),
      });
    }
    return cadences;
  },
};
