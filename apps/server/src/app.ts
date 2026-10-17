import { Hono } from "hono";
import { env, features } from "./env.ts";

export const app = new Hono();

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
