import { timingSafeEqual } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { env, features } from "../env.ts";

/** Owner routes need `x-owner-token`. The browser never holds it; lane 1's route handlers add it server side. */
export const requireOwner = createMiddleware(async (c, next) => {
  if (!features.ownerRoutes) return c.json({ error: "OWNER_TOKEN is not configured on the server" }, 503);
  if (!features.database) return c.json({ error: "Database is not configured on the server" }, 503);
  const given = Buffer.from(c.req.header("x-owner-token") ?? "");
  const expected = Buffer.from(env.OWNER_TOKEN!);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return c.json({ error: "Invalid owner token" }, 401);
  }
  await next();
});
