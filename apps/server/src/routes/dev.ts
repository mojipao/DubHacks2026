import { Hono } from "hono";
import { z } from "zod";
import { ingestInbound } from "../inbound.ts";
import { requireOwner } from "./owner-auth.ts";

const InboundBody = z.object({
  handle: z.string().min(3).max(120),
  name: z.string().min(1).max(80).optional(),
  text: z.string().min(1).max(2000),
});

export const dev = new Hono();
dev.use("*", requireOwner);

/** Simulated customer text: the phone simulator and every lane's integration tests use this. */
dev.post("/inbound", async (c) => {
  const body = InboundBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);
  const result = await ingestInbound({ platform: "simulated", ...body.data });
  return c.json(result);
});
