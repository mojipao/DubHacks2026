import { Hono } from "hono";
import { z } from "zod";
import { approve, reject, retry } from "../execute.ts";
import { requireOwner } from "./owner-auth.ts";

const ApproveBody = z
  .object({
    editedText: z.string().optional(),
    /** Send the agent's alternative wording at this index instead of its main draft. */
    alternativeIndex: z.number().int().min(0).max(2).optional(),
    includeLinked: z.boolean().optional(),
  })
  .refine((b) => b.editedText === undefined || b.alternativeIndex === undefined, "Send editedText or alternativeIndex, not both");
const RejectBody = z.object({ reason: z.string().max(500).optional(), includeLinked: z.boolean().optional() });

export const proposals = new Hono();
proposals.use("*", requireOwner);

proposals.post("/:id/approve", async (c) => {
  const body = ApproveBody.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);
  return c.json({ proposals: await approve(c.req.param("id"), body.data) });
});

proposals.post("/:id/reject", async (c) => {
  const body = RejectBody.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);
  return c.json({ proposals: await reject(c.req.param("id"), body.data) });
});

proposals.post("/:id/retry", async (c) => c.json({ proposals: await retry(c.req.param("id")) }));
