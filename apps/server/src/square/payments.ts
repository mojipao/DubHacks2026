import { business } from "../business.ts";
import { db } from "../db.ts";
import { env } from "../env.ts";
import type { Payments } from "../execute.ts";
import { square } from "./client.ts";

function pickupLabel(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: business.timezone,
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

/** One Square payment link for every order in a reply. Line names carry the pickup day, so a split counteroffer reads clearly. */
export const squarePayments: Payments = {
  async createLink({ proposalId, customerId, orders }) {
    let squareCustomerId: string | undefined;
    let phone: string | undefined;
    if (customerId) {
      const { data } = await db().from("customers").select("square_customer_id, handle").eq("id", customerId).maybeSingle();
      squareCustomerId = data?.square_customer_id ?? undefined;
      phone = data?.handle && !data.handle.includes("@") ? data.handle : undefined;
    }
    const discountCents = orders.reduce((sum, o) => sum + (o.discountCents ?? 0), 0);

    const res = await square().checkout.paymentLinks.create({
      idempotencyKey: `proposal:${proposalId}`,
      order: {
        locationId: env.SQUARE_LOCATION_ID!,
        customerId: squareCustomerId,
        referenceId: proposalId,
        lineItems: orders.flatMap((o) =>
          o.lines.map((l) => ({
            name: `${l.name} · ${pickupLabel(o.pickupAt)}`,
            quantity: String(l.qty),
            basePriceMoney: { amount: BigInt(l.unitPriceCents), currency: "USD" as const },
          })),
        ),
        discounts: discountCents
          ? [{ name: "Welcome back", amountMoney: { amount: BigInt(discountCents), currency: "USD" as const }, scope: "ORDER" as const }]
          : undefined,
      },
      prePopulatedData: phone ? { buyerPhoneNumber: phone } : undefined,
      paymentNote: `${business.name} pickup order`,
    });
    const link = res.paymentLink;
    if (!link?.id || !link.url || !link.orderId) {
      throw new Error(`Square payment link failed: ${JSON.stringify(res.errors ?? "no link returned")}`);
    }
    return { linkId: link.id, url: link.url, squareOrderId: link.orderId };
  },
};
