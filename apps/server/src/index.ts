import { serve } from "@hono/node-server";
import { app } from "./app.ts";
import { env, features } from "./env.ts";
import { setIntegrations } from "./execute.ts";
import { photonMessenger } from "./photon/messenger.ts";
import { startPhotonInbound } from "./photon/inbound.ts";
import { squarePayments } from "./square/payments.ts";

// Missing keys keep the simulated Messenger and Payments, so the server runs on any teammate's machine.
setIntegrations({
  messenger: features.photon ? photonMessenger : undefined,
  payments: features.square ? squarePayments : undefined,
});
if (features.photon && features.database) {
  startPhotonInbound().catch((err) => console.error("Photon inbound failed to start", err));
}

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Back of House server listening on http://localhost:${info.port}`);
});
