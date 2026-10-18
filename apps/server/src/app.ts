import { Hono } from "hono";
import { cors } from "hono/cors";
import { env, features } from "./env.ts";
import { HttpError } from "./execute.ts";
import { maskHandle } from "./inbound.ts";
import { photonStatus } from "./photon/inbound.ts";
import { contacts } from "./routes/contacts.ts";
import { conversations } from "./routes/conversations.ts";
import { dev } from "./routes/dev.ts";
import { join } from "./routes/join.ts";
import { proposals } from "./routes/proposals.ts";
import { webhooks } from "./routes/webhooks.ts";

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
    photonSocket: { connected: photonStatus.connected, cursor: photonStatus.cursor, lastError: photonStatus.lastError },
    squareMode: features.square ? env.SQUARE_ENVIRONMENT : "unconfigured",
    agentMode: env.AGENT_MODE,
    ownerHandleConfigured: Boolean(env.OWNER_HANDLE),
    // Masked: /health is public. The phone simulator's Owner persona posts handle "owner" to /dev/inbound instead.
    ownerHandle: env.OWNER_HANDLE ? maskHandle(env.OWNER_HANDLE) : null,
    ownerNotify: env.OWNER_NOTIFY,
    squareWebhook: Boolean(env.SQUARE_WEBHOOK_SIGNATURE_KEY && env.SQUARE_WEBHOOK_URL),
  }),
);

app.route("/proposals", proposals);
app.route("/dev", dev);
app.route("/contacts", contacts);
app.route("/conversations", conversations);
app.route("/join", join);
app.route("/webhooks", webhooks);
