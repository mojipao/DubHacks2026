import { Hono } from "hono";
import { z } from "zod";
import { business } from "../business.ts";
import { db } from "../db.ts";
import { maskHandle } from "../inbound.ts";
import { requireOwner } from "./owner-auth.ts";

/** Where a contact is in the funnel. `lead` texted but never ordered through the agent and has no history. */
type Stage = "owner" | "lead" | "ordered" | "paid" | "regular";

export const contacts = new Hono();
contacts.use("*", requireOwner);

async function loadContacts() {
  const [convRes, msgRes, orderRes, propRes] = await Promise.all([
    db()
      .from("conversations")
      .select("id, handle, role, platform, customer_id, created_at, last_message_at, customers(name, notes, is_demo_persona)")
      .order("last_message_at", { ascending: false }),
    db().from("messages").select("conversation_id, direction, body, created_at").order("created_at").limit(20_000),
    db().from("orders").select("customer_id, source, status, total_cents, discount_cents").not("customer_id", "is", null).limit(20_000),
    db().from("proposals").select("conversation_id").eq("status", "pending"),
  ]);
  for (const r of [convRes, msgRes, orderRes, propRes]) if (r.error) throw new Error(`contacts: ${r.error.message}`);

  const msgs = new Map<string, { inbound: number; outbound: number; last?: { direction: string; body: string; at: string } }>();
  for (const m of msgRes.data ?? []) {
    const s = msgs.get(m.conversation_id) ?? { inbound: 0, outbound: 0 };
    if (m.direction === "inbound") s.inbound++;
    else s.outbound++;
    s.last = { direction: m.direction, body: m.body.slice(0, 160), at: m.created_at };
    msgs.set(m.conversation_id, s);
  }

  const orders = new Map<string, { agentOrders: number; paidCents: number; awaitingCents: number; historyOrders: number }>();
  for (const o of orderRes.data ?? []) {
    const s = orders.get(o.customer_id!) ?? { agentOrders: 0, paidCents: 0, awaitingCents: 0, historyOrders: 0 };
    const net = o.total_cents - o.discount_cents;
    if (o.source === "history") s.historyOrders++;
    else {
      s.agentOrders++;
      if (o.status === "paid" || o.status === "fulfilled") s.paidCents += net;
      if (o.status === "awaiting_payment") s.awaitingCents += net;
    }
    orders.set(o.customer_id!, s);
  }

  const pending = new Map<string, number>();
  for (const p of propRes.data ?? []) if (p.conversation_id) pending.set(p.conversation_id, (pending.get(p.conversation_id) ?? 0) + 1);

  return (convRes.data ?? []).map((c) => {
    const m = msgs.get(c.id) ?? { inbound: 0, outbound: 0 };
    const o = (c.customer_id && orders.get(c.customer_id)) || { agentOrders: 0, paidCents: 0, awaitingCents: 0, historyOrders: 0 };
    const stage: Stage =
      c.role === "owner"
        ? "owner"
        : o.paidCents > 0
          ? "paid"
          : o.agentOrders > 0
            ? "ordered"
            : o.historyOrders >= business.winbackMinOrders
              ? "regular"
              : "lead";
    return {
      conversationId: c.id,
      customerId: c.customer_id,
      name: c.customers?.name ?? null,
      notes: c.customers?.notes ?? null,
      isDemoPersona: c.customers?.is_demo_persona ?? false,
      handle: c.handle,
      handleMasked: maskHandle(c.handle),
      role: c.role,
      platform: c.platform,
      stage,
      firstSeenAt: c.created_at,
      lastMessageAt: c.last_message_at,
      lastMessage: m.last ?? null,
      messages: { inbound: m.inbound, outbound: m.outbound },
      pendingTickets: pending.get(c.id) ?? 0,
      orders: o,
    };
  });
}

/** One row per person who has texted the shop (plus the owner), with funnel stage and money. `?format=csv` downloads it. */
contacts.get("/", async (c) => {
  const rows = await loadContacts();
  if (c.req.query("format") !== "csv") return c.json({ contacts: rows });

  const cols = ["name", "handle", "stage", "platform", "firstSeenAt", "lastMessageAt", "inbound", "outbound", "agentOrders", "paidCents", "awaitingCents", "historyOrders"];
  const cell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const lines = rows
    .filter((r) => r.role !== "owner")
    .map((r) =>
      [r.name, r.handle, r.stage, r.platform, r.firstSeenAt, r.lastMessageAt, r.messages.inbound, r.messages.outbound, r.orders.agentOrders, r.orders.paidCents, r.orders.awaitingCents, r.orders.historyOrders]
        .map(cell)
        .join(","),
    );
  return c.body([cols.join(","), ...lines].join("\n"), 200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
  });
});

const HistoryQuery = z.object({
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

/** Full thread history, oldest first, paged backwards with `?before=<createdAt of the oldest message you have>`. */
contacts.get("/:conversationId/messages", async (c) => {
  const q = HistoryQuery.safeParse(c.req.query());
  if (!q.success) return c.json({ error: z.prettifyError(q.error) }, 400);
  let query = db()
    .from("messages")
    .select("id, direction, body, status, created_at")
    .eq("conversation_id", c.req.param("conversationId"))
    .order("created_at", { ascending: false })
    .limit(q.data.limit + 1);
  if (q.data.before) query = query.lt("created_at", q.data.before);
  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);
  const page = (data ?? []).slice(0, q.data.limit).reverse();
  return c.json({ messages: page, hasMore: (data?.length ?? 0) > q.data.limit });
});
