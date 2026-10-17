import { Hono } from "hono";
import { cors } from "hono/cors";
import { env, features } from "./env.ts";
import { HttpError } from "./execute.ts";
import { dev } from "./routes/dev.ts";
import { proposals } from "./routes/proposals.ts";

export const app = new Hono();

app.use("*", cors({ origin: "http://localhost:3000" }));

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: err.message }, 500);
});

app.get("/health", (c) =>
  c.json({
    ok: true,
    database: features.database,
    photonInbound: features.photon ? env.PHOTON_INBOUND : "unconfigured",
    squareMode: features.square ? env.SQUARE_ENVIRONMENT : "unconfigured",
    agentMode: env.AGENT_MODE,
    ownerHandleConfigured: Boolean(env.OWNER_HANDLE),
  }),
);

app.route("/proposals", proposals);
app.route("/dev", dev);
