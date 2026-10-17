import { Hono } from "hono";
import { WebhooksHelper } from "square";
import { env } from "../env.ts";
import { settlePaid } from "../settle.ts";

interface SquarePaymentEvent {
  type?: string;
  event_id?: string;
  data?: { object?: { payment?: { id?: string; status?: string; order_id?: string } } };
}

export const webhooks = new Hono();

/** Square payment webhook. Verifies the signature against the raw body, answers fast, settles after. */
webhooks.post("/square", async (c) => {
  if (!env.SQUARE_WEBHOOK_SIGNATURE_KEY || !env.SQUARE_WEBHOOK_URL) {
    return c.json({ error: "Square webhook not configured" }, 503);
  }
  const raw = await c.req.text();
  const valid = await WebhooksHelper.verifySignature({
    requestBody: raw,
    signatureHeader: c.req.header("x-square-hmacsha256-signature") ?? "",
    signatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    notificationUrl: env.SQUARE_WEBHOOK_URL,
  });
  if (!valid) return c.json({ error: "Invalid signature" }, 403);

  const event = JSON.parse(raw) as SquarePaymentEvent;
  const payment = event.data?.object?.payment;
  if ((event.type === "payment.updated" || event.type === "payment.created") && payment?.status === "COMPLETED" && payment.order_id) {
    settlePaid({ squareOrderId: payment.order_id }, "square", { paymentId: payment.id, eventId: event.event_id }).catch((err) =>
      console.error("settle from webhook failed", err),
    );
  }
  return c.json({ ok: true });
});
