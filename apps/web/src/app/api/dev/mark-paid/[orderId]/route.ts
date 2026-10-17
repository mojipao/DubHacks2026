import { forwardToServer } from "@/lib/server-proxy";

export async function POST(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  return forwardToServer(`/dev/mark-paid/${encodeURIComponent(orderId)}`);
}
