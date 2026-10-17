import { forwardToServer, readJson } from "@/lib/server-proxy";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return forwardToServer(`/proposals/${encodeURIComponent(id)}/approve`, {
    body: await readJson(request),
  });
}
