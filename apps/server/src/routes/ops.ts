import { Hono } from "hono";
import { env, features } from "../env.ts";
import { business } from "../business.ts";
import { db } from "../db.ts";
import { photonStatus } from "../photon/inbound.ts";
import { addDays, localDateOf } from "../time.ts";
import { requireOwner } from "./owner-auth.ts";

const WINDOW_DAYS = 14;
const BURN_DAYS = 28;

export const ops = new Hono();
ops.use("*", requireOwner);

/**
 * House numbers from paid Square (and seed history) so the owner sees leads, sales,
 * and when stock actually runs out — not just today's pickup board.
 */
ops.get("/", async (c) => {
  const tz = business.timezone;
  const now = new Date();
  const today = localDateOf(now, tz);
  const from = addDays(today, -(WINDOW_DAYS - 1));
  const burnFrom = addDays(today, -(BURN_DAYS - 1));

  const [convRes, orderRes, itemRes, ingRes, recipeRes, eventRes, pendingRes, productsRes] = await Promise.all([
    db().from("conversations").select("id, role, customer_id"),
    db()
      .from("orders")
      .select("id, customer_id, source, status, total_cents, discount_cents, paid_at, created_at, square_order_id")
      .limit(20_000),
    db().from("order_items").select("order_id, product_id, qty, unit_price_cents").limit(50_000),
    db().from("ingredients").select("id, name, unit, on_hand, on_order, reorder_point").order("name"),
    db().from("recipe_lines").select("product_id, ingredient_id, qty_per_unit"),
    db().from("events").select("type, actor, at, data").order("at", { ascending: false }).limit(2_000),
    db().from("proposals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db().from("products").select("id, name"),
  ]);
  for (const r of [convRes, orderRes, itemRes, ingRes, recipeRes, eventRes, productsRes]) {
    if (r.error) throw new Error(`ops: ${r.error.message}`);
  }
  const productName = new Map((productsRes.data ?? []).map((p) => [p.id, p.name]));

  const itemsByOrder = new Map<string, { productId: string; qty: number; unitPriceCents: number }[]>();
  for (const row of itemRes.data ?? []) {
    const list = itemsByOrder.get(row.order_id) ?? [];
    list.push({ productId: row.product_id, qty: row.qty, unitPriceCents: row.unit_price_cents });
    itemsByOrder.set(row.order_id, list);
  }

  const net = (o: { total_cents: number; discount_cents: number }) => o.total_cents - o.discount_cents;
  const paidOk = (s: string) => s === "paid" || s === "fulfilled";

  const orders = orderRes.data ?? [];
  const onlinePaid = orders.filter((o) => o.source === "agent" && paidOk(o.status) && o.paid_at);
  const historyPaid = orders.filter((o) => o.source === "history" && paidOk(o.status));
  const awaiting = orders.filter((o) => o.source === "agent" && o.status === "awaiting_payment");

  const byDayMap = new Map<string, { onlineCents: number; onlineOrders: number }>();
  for (let i = 0; i < WINDOW_DAYS; i++) byDayMap.set(addDays(from, i), { onlineCents: 0, onlineOrders: 0 });
  for (const o of onlinePaid) {
    const day = localDateOf(new Date(o.paid_at!), tz);
    const row = byDayMap.get(day);
    if (!row) continue;
    row.onlineCents += net(o);
    row.onlineOrders += 1;
  }

  const byProduct = new Map<string, { units: number; cents: number }>();
  for (const o of onlinePaid) {
    for (const item of itemsByOrder.get(o.id) ?? []) {
      const cur = byProduct.get(item.productId) ?? { units: 0, cents: 0 };
      cur.units += item.qty;
      cur.cents += item.qty * item.unitPriceCents;
      byProduct.set(item.productId, cur);
    }
  }

  const paidByCustomer = new Map<string, { agentPaid: number; agentOrders: number; history: number }>();
  for (const o of orders) {
    if (!o.customer_id) continue;
    const s = paidByCustomer.get(o.customer_id) ?? { agentPaid: 0, agentOrders: 0, history: 0 };
    if (o.source === "history") s.history += 1;
    else {
      s.agentOrders += 1;
      if (paidOk(o.status)) s.agentPaid += 1;
    }
    paidByCustomer.set(o.customer_id, s);
  }

  let leads = 0,
    ordered = 0,
    paid = 0,
    regular = 0;
  for (const conv of convRes.data ?? []) {
    if (conv.role === "owner") continue;
    const o = (conv.customer_id && paidByCustomer.get(conv.customer_id)) || { agentPaid: 0, agentOrders: 0, history: 0 };
    if (o.agentPaid > 0) paid += 1;
    else if (o.agentOrders > 0) ordered += 1;
    else if (o.history >= business.winbackMinOrders) regular += 1;
    else leads += 1;
  }

  const burnFromMs = new Date(`${burnFrom}T00:00:00`).getTime();
  const usage = new Map<string, number>();
  const burnOrders = orders.filter((o) => paidOk(o.status) && (o.paid_at || o.source === "history"));
  for (const o of burnOrders) {
    const when = o.paid_at ?? o.created_at;
    if (new Date(when).getTime() < burnFromMs) continue;
    for (const item of itemsByOrder.get(o.id) ?? []) {
      for (const line of recipeRes.data ?? []) {
        if (line.product_id !== item.productId) continue;
        usage.set(line.ingredient_id, (usage.get(line.ingredient_id) ?? 0) + item.qty * Number(line.qty_per_unit));
      }
    }
  }

  const stock = (ingRes.data ?? []).map((ing) => {
    const used = usage.get(ing.id) ?? 0;
    const avgPerDay = used / BURN_DAYS;
    const available = Number(ing.on_hand) + Number(ing.on_order);
    const daysOfCover = avgPerDay > 0 ? available / avgPerDay : null;
    const shelf = Number(ing.on_hand);
    const daysToReorder =
      avgPerDay > 0 && shelf > Number(ing.reorder_point) ? (shelf - Number(ing.reorder_point)) / avgPerDay : avgPerDay > 0 && shelf <= Number(ing.reorder_point) ? 0 : null;
    const restockBy =
      daysToReorder === null ? null : daysToReorder <= 0 ? today : addDays(today, Math.max(1, Math.ceil(daysToReorder)));
    return {
      ingredientId: ing.id,
      name: ing.name,
      unit: ing.unit,
      onHand: Number(ing.on_hand),
      onOrder: Number(ing.on_order),
      reorderPoint: Number(ing.reorder_point),
      avgPerDay: Math.round(avgPerDay * 1000) / 1000,
      daysOfCover: daysOfCover === null ? null : Math.round(daysOfCover * 10) / 10,
      restockBy,
    };
  });
  stock.sort((a, b) => (a.daysOfCover ?? 999) - (b.daysOfCover ?? 999));

  const events = eventRes.data ?? [];
  const lastReset = events.find((e) => e.type === "demo.reset")?.at;
  const since = lastReset ? events.filter((e) => e.at >= lastReset) : events;
  const sent = since.filter((e) => e.type === "message.sent");
  const approved = new Set(
    since.filter((e) => e.type === "proposal.approved").map((e) => String((e.data as { proposalId?: string }).proposalId ?? "")),
  );
  const sentWithoutApproval = sent.filter((e) => {
    const via = (e.data as { via?: string }).via;
    return via !== "agent" && !approved.has(String((e.data as { proposalId?: string }).proposalId ?? ""));
  }).length;

  return c.json({
    generatedAt: now.toISOString(),
    funnel: { leads, ordered, paid, regular },
    sales: {
      onlinePaidCents: onlinePaid.reduce((n, o) => n + net(o), 0),
      onlinePaidOrders: onlinePaid.length,
      awaitingCents: awaiting.reduce((n, o) => n + net(o), 0),
      historyPaidCents: historyPaid.reduce((n, o) => n + net(o), 0),
      squarePaidOrders: onlinePaid.filter((o) => Boolean(o.square_order_id)).length,
      byDay: [...byDayMap.entries()].map(([date, v]) => ({ date, ...v })),
      byProduct: [...byProduct.entries()]
        .map(([productId, v]) => ({ productId, name: productName.get(productId) ?? productId, ...v }))
        .sort((a, b) => b.cents - a.cents)
        .slice(0, 8),
    },
    stock,
    observability: {
      photonConnected: features.photon ? photonStatus.connected : false,
      photonMode: photonStatus.mode,
      autonomy: env.AUTONOMY,
      square: features.square,
      pendingTickets: pendingRes.count ?? 0,
      eventsSinceReset: since.length,
      agentSteps: since.filter((e) => e.type === "agent.step").length,
      sentWithoutApproval,
    },
  });
});
