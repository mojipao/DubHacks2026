import { getFromServer } from "@/lib/server-proxy";

export async function GET(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const { search } = new URL(request.url);
  return getFromServer(`/contacts/${encodeURIComponent(conversationId)}/messages${search}`);
}
