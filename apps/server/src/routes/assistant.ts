import { Hono } from "hono";
import { z } from "zod";
import { ask, sendCampaign } from "../owner-assistant.ts";
import { reviewCall, syncCalls } from "../voice/calls.ts";
import { requireOwner } from "./owner-auth.ts";

export const assistant = new Hono();
assistant.use("*", requireOwner);

/** The owner asks the agent something: stock, a text to customers (previewed, not sent), or a call. */
assistant.post("/ask", async (c) => {
  const body = z.object({ text: z.string().min(1).max(1000) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);
  return c.json(await ask(body.data.text));
});

/** Sends a previewed text to the conversations the owner kept checked. */
assistant.post("/campaigns/send", async (c) => {
  const body = z
    .object({ text: z.string().min(1).max(1000), conversationIds: z.array(z.string().uuid()).min(1).max(200) })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);
  return c.json(await sendCampaign(body.data.text, body.data.conversationIds));
});

/** Pulls finished phone calls now instead of waiting for the next 20-second sync. */
assistant.post("/calls/sync", async (c) => c.json({ imported: await syncCalls() }));

/** Marks a transcribed call as reviewed or skipped. Approve/skip of its tickets still goes through /proposals. */
assistant.post("/calls/review", async (c) => {
  const body = z
    .object({ callId: z.string().min(1), action: z.enum(["reviewed", "skipped"]) })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);
  return c.json(await reviewCall(body.data.callId, body.data.action));
});
