import { Hono } from "hono";
import { z } from "zod";
import { sendOwnerMessage } from "../execute.ts";
import { requireOwner } from "./owner-auth.ts";

const SendBody = z.object({
  text: z.string().min(1).max(1200),
  /** A stable id from the client (e.g. a UUID made when the owner pressed Send), so a double click sends once. */
  clientId: z.string().min(8).max(80).optional(),
});

export const conversations = new Hono();
conversations.use("*", requireOwner);

/** The owner's own message to a customer, sent immediately. */
conversations.post("/:id/send", async (c) => {
  const body = SendBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);
  return c.json(await sendOwnerMessage(c.req.param("id"), body.data.text, { clientId: body.data.clientId }));
});
