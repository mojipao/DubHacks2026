import { forwardToServer } from "@/lib/server-proxy";

/** Pays the order's real Square sandbox link, so the signed webhook settles it like a customer would. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  return forwardToServer(`/dev/square-pay/${encodeURIComponent(orderId)}`);
}
