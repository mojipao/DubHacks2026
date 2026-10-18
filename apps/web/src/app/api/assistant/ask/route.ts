import { forwardToServer, readJson } from "@/lib/server-proxy";

/** The owner asks the agent: stock, a text to customers (previewed), or a call. */
export async function POST(request: Request) {
  return forwardToServer("/assistant/ask", { body: await readJson(request) });
}
