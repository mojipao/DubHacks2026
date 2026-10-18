import { forwardToServer, readJson } from "@/lib/server-proxy";

/** The owner's own message to a customer, sent immediately. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return forwardToServer(`/conversations/${encodeURIComponent(id)}/send`, { body: await readJson(request) });
}
