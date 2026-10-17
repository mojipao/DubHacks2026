import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db.ts";
import { env } from "../env.ts";
import { logEvent } from "../events.ts";
import { ingestInbound } from "../inbound.ts";
import { settlePaid } from "../settle.ts";
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
