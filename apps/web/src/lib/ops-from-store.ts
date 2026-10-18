import recipesJson from "../../../../data/seed/recipes.json";
import { addDaysKey, localDateKey } from "@/lib/format";
import type { OpsReport, StoreState, UiContact } from "@/lib/data/types";

const WINDOW = 14;
const BURN = 28;

/** Mock-mode House numbers from the in-memory snapshot, same shape as GET /ops. */
export function opsFromStore(state: StoreState, contacts: UiContact[]): OpsReport {
  const today = localDateKey(state.now);
  const from = addDaysKey(today, -(WINDOW - 1));
  const paidOk = (s: string) => s === "paid" || s === "fulfilled";
  const net = (o: { totalCents: number; discountCents: number }) => o.totalCents - o.discountCents;

  const onlinePaid = state.orders.filter((o) => o.source === "agent" && paidOk(o.status) && o.paidAt);
  const historyPaid = state.orders.filter((o) => o.source === "history" && paidOk(o.status));
  const awaiting = state.orders.filter((o) => o.source === "agent" && o.status === "awaiting_payment");

  const byDayMap = new Map<string, { onlineCents: number; onlineOrders: number }>();
  for (let i = 0; i < WINDOW; i++) byDayMap.set(addDaysKey(from, i), { onlineCents: 0, onlineOrders: 0 });
  for (const o of onlinePaid) {
    const day = localDateKey(o.paidAt!);
    const row = byDayMap.get(day);
    if (!row) continue;
    row.onlineCents += net(o);
    row.onlineOrders += 1;
  }

  const byProduct = new Map<string, { name: string; units: number; cents: number }>();
  for (const o of onlinePaid) {
    const share = net(o);
    const units = o.items.reduce((n, i) => n + i.qty, 0) || 1;
    for (const item of o.items) {
      const cur = byProduct.get(item.productId) ?? { name: item.name, units: 0, cents: 0 };
      cur.units += item.qty;
      cur.cents += Math.round((share * item.qty) / units);
      byProduct.set(item.productId, cur);
    }
  }

  const funnel = { leads: 0, ordered: 0, paid: 0, regular: 0 };
  for (const c of contacts) {
    if (c.role === "owner") continue;
    if (c.stage === "paid") funnel.paid += 1;
    else if (c.stage === "ordered") funnel.ordered += 1;
    else if (c.stage === "regular") funnel.regular += 1;
    else if (c.stage === "lead") funnel.leads += 1;
  }

  const burnFrom = addDaysKey(today, -(BURN - 1));
  const usage = new Map<string, number>();
  for (const o of state.orders.filter((o) => paidOk(o.status))) {
    const when = o.paidAt ?? o.createdAt;
    if (localDateKey(when) < burnFrom) continue;
    for (const item of o.items) {
      for (const line of recipesJson) {
        if (line.productId !== item.productId) continue;
        usage.set(line.ingredientId, (usage.get(line.ingredientId) ?? 0) + item.qty * line.qtyPerUnit);
      }
    }
  }

  const stock = state.ingredients.map((ing) => {
    const avgPerDay = (usage.get(ing.id) ?? 0) / BURN;
    const available = ing.onHand + ing.onOrder;
    const daysOfCover = avgPerDay > 0 ? available / avgPerDay : null;
    const daysToReorder =
      avgPerDay > 0 && ing.onHand > ing.reorderPoint
        ? (ing.onHand - ing.reorderPoint) / avgPerDay
        : avgPerDay > 0 && ing.onHand <= ing.reorderPoint
          ? 0
          : null;
    const restockBy =
      daysToReorder === null ? null : daysToReorder <= 0 ? today : addDaysKey(today, Math.max(1, Math.ceil(daysToReorder)));
    return {
      ingredientId: ing.id,
      name: ing.name,
      unit: ing.unit,
      onHand: ing.onHand,
      onOrder: ing.onOrder,
      reorderPoint: ing.reorderPoint,
      avgPerDay: Math.round(avgPerDay * 1000) / 1000,
      daysOfCover: daysOfCover === null ? null : Math.round(daysOfCover * 10) / 10,
      restockBy,
    };
  });
  stock.sort((a, b) => (a.daysOfCover ?? 999) - (b.daysOfCover ?? 999));

  return {
    generatedAt: state.now,
    funnel,
    sales: {
      onlinePaidCents: onlinePaid.reduce((n, o) => n + net(o), 0),
      onlinePaidOrders: onlinePaid.length,
      awaitingCents: awaiting.reduce((n, o) => n + net(o), 0),
      historyPaidCents: historyPaid.reduce((n, o) => n + net(o), 0),
      squarePaidOrders: onlinePaid.length,
      byDay: [...byDayMap.entries()].map(([date, v]) => ({ date, ...v })),
      byProduct: [...byProduct.entries()]
        .map(([productId, v]) => ({ productId, ...v }))
        .sort((a, b) => b.cents - a.cents)
        .slice(0, 8),
    },
    stock,
    observability: {
      photonConnected: false,
      photonMode: "off",
      autonomy: "on",
      square: false,
      pendingTickets: state.proposals.filter((p) => p.status === "pending").length,
      eventsSinceReset: state.events.length,
      agentSteps: state.events.filter((e) => e.type === "agent.step").length,
      sentWithoutApproval: 0,
    },
  };
}
