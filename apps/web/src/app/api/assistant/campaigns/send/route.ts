import { forwardToServer, readJson } from "@/lib/server-proxy";

/** Sends a previewed text to the conversations the owner kept checked. */
export async function POST(request: Request) {
  return forwardToServer("/assistant/campaigns/send", { body: await readJson(request) });
}
