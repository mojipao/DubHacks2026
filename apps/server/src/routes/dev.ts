import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db.ts";
import { env, features } from "../env.ts";
import { logEvent } from "../events.ts";
import { ingestInbound } from "../inbound.ts";
import { settlePaid } from "../settle.ts";
import { square } from "../square/client.ts";
import { runWinback } from "../winback.ts";
import { requireOwner } from "./owner-auth.ts";

const InboundBody = z.object({
  handle: z.string().min(3).max(120).describe('E.164 phone, iMessage email, or "owner"'),
  name: z.string().min(1).max(80).optional(),
  text: z.string().min(1).max(2000),
});

export const dev = new Hono();
dev.use("*", requireOwner);

/** Simulated customer text: the phone simulator and every lane's integration tests use this. */
dev.post("/inbound", async (c) => {
  const body = InboundBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);
  // "owner" stands in for OWNER_HANDLE, so the simulator can test owner commands without the real number reaching the browser.
  let { handle } = body.data;
  if (handle.toLowerCase() === "owner") {
    if (!env.OWNER_HANDLE) return c.json({ error: "OWNER_HANDLE is not set on the server" }, 400);
    handle = env.OWNER_HANDLE;
  }
  const result = await ingestInbound({ platform: "simulated", ...body.data, handle });
  return c.json(result);
});

/** Demo fallback when the Square webhook can't reach the laptop. Same settle path as a real payment. */
dev.post("/mark-paid/:orderId", async (c) => {
  const orderId = c.req.param("orderId");
  const { data: order } = await db().from("orders").select("id, square_order_id, status").eq("id", orderId).maybeSingle();
  if (!order) return c.json({ error: "Order not found" }, 404);
  // Pay the whole link, so both halves of a split counteroffer flip together, as they would from Square.
  const result = await settlePaid(
    order.square_order_id ? { squareOrderId: order.square_order_id } : { orderId },
    "owner",
    { via: "dev/mark-paid" },
  );
  return c.json(result);
});

/**
 * Sandbox payment links are preview-only, so nobody can tap through and pay one. This pays the
 * link's Square order with Square's sandbox card token instead, so the real signed
 * `payment.updated` webhook arrives and settles the orders exactly as a customer payment would.
 */
dev.post("/square-pay/:orderId", async (c) => {
  if (!features.square) return c.json({ error: "Square is not configured" }, 503);
  if (env.SQUARE_ENVIRONMENT !== "sandbox") return c.json({ error: "Only available in the Square sandbox" }, 400);
  const { data: order } = await db().from("orders").select("square_order_id").eq("id", c.req.param("orderId")).maybeSingle();
  if (!order) return c.json({ error: "Order not found" }, 404);
  if (!order.square_order_id || order.square_order_id.startsWith("sim_")) {
    return c.json({ error: "This order has no Square payment link (created while Square was not configured)" }, 409);
  }

  // Pay what Square says is due, so the amount always matches the link (both halves of a split, minus any perk).
  let { order: sqOrder } = await square().orders.get({ orderId: order.square_order_id });
  // Payment-link orders stay DRAFT until checkout, and Square only takes payment on an OPEN order.
  if (sqOrder?.state === "DRAFT") {
    ({ order: sqOrder } = await square().orders.update({
      orderId: order.square_order_id,
      idempotencyKey: `dev-open:${order.square_order_id}`,
      order: { locationId: env.SQUARE_LOCATION_ID!, version: sqOrder.version, state: "OPEN" },
    }));
  }
  const due = sqOrder?.netAmountDueMoney ?? sqOrder?.totalMoney;
  if (!due?.amount) return c.json({ error: "Nothing due on this Square order; it may already be paid" }, 409);

  const { payment } = await square().payments.create({
    // Includes the order version: a retry after the DRAFT→OPEN change must not replay an earlier, voided attempt.
    idempotencyKey: `dev-pay:${order.square_order_id}:${sqOrder?.version ?? 0}`,
    sourceId: "cnon:card-nonce-ok",
    orderId: order.square_order_id,
    locationId: env.SQUARE_LOCATION_ID!,
    amountMoney: due,
    autocomplete: true,
  });
  return c.json({ paymentId: payment?.id ?? null, status: payment?.status ?? null, amountCents: Number(due.amount) });
});

/** Simulated supplier delivery: moves everything on order into stock. */
dev.post("/receive-delivery", async (c) => {
  const { data, error } = await db().from("ingredients").select("id, on_hand, on_order").gt("on_order", 0);
  if (error) return c.json({ error: error.message }, 500);
  for (const ing of data ?? []) {
    const onHand = Number(ing.on_hand) + Number(ing.on_order);
    await db().from("ingredients").update({ on_hand: onHand, on_order: 0 }).eq("id", ing.id);
    await logEvent("system", "inventory.received", { type: "ingredient", id: ing.id }, { qty: Number(ing.on_order), simulated: true });
  }
  return c.json({ received: data?.length ?? 0 });
});

/** The "Morning scan" button. */
dev.post("/winback-scan", async (c) => {
  const result = await runWinback();
  if (!result.available) return c.json({ error: "runWinbackScan is not exported by @boh/agents yet", created: 0 }, 501);
  return c.json({ created: result.created });
});
