import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db.ts";
import { env, features } from "../env.ts";
import { logEvent } from "../events.ts";
import { rememberCustomerName } from "../identity.ts";
import { normalizeHandle } from "../inbound.ts";
import { photon, projectPath } from "../photon/client.ts";

const JoinBody = z.object({
  name: z.string().trim().min(1).max(60),
  handle: z
    .string()
    .trim()
    .transform(normalizeHandle)
    .refine((h) => /^\+[1-9]\d{7,14}$/.test(h) || z.email().safeParse(h).success, "Use a phone number like +12065550100 or an iMessage email"),
});

const WINDOW_MS = 10 * 60_000;
const LIMIT = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}

export const join = new Hono();

/** Judge onboarding: assigns the judge's handle to the shared iMessage line so their texts reach us. */
join.post("/", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? getConnInfo(c).remote.address ?? "unknown";
  if (rateLimited(ip)) return c.json({ error: "Too many sign-ups from this network. Try again in a few minutes." }, 429);

  const body = JoinBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);
  if (!features.database) return c.json({ error: "Database is not configured on the server" }, 503);
  if (!features.photon) return c.json({ error: "iMessage isn't connected right now. Ask the team at the table." }, 503);
  const { name, handle } = body.data;
  if (env.OWNER_HANDLE && handle === normalizeHandle(env.OWNER_HANDLE)) {
    return c.json({ error: "That number belongs to the shop owner." }, 400);
  }

  const saved = await rememberCustomerName(handle, name, null, { trusted: true });
  if (!saved) return c.json({ error: "Use a first and last name, letters only." }, 400);
  const customerId = saved.customerId;

  let agentNumber: string;
  try {
    const assignment = await photon().projects.platforms.imessage.assignments.create({
      path: projectPath(),
      headers: { idempotencyKey: `join:${handle}` },
      body: { handle },
    });
    agentNumber = assignment.assignedPhoneNumber;
  } catch (err) {
    console.error("Photon assignment failed", err);
    return c.json({ error: "Couldn't connect your number. Ask the team at the table." }, 502);
  }

  const { count } = await db().from("events").select("id", { count: "exact", head: true }).eq("type", "customer.joined");
  await logEvent("system", "customer.joined", { type: "customer", id: customerId }, { agentNumber, joinedSoFar: (count ?? 0) + 1 });
  console.log(`Photon shared-line assignments used: ${(count ?? 0) + 1} of 25 (free plan)`);
  return c.json({ agentNumber, customerId });
});
