import { serve } from "@hono/node-server";
import { app } from "./app.ts";
import { env } from "./env.ts";

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Back of House server listening on http://localhost:${info.port}`);
});
