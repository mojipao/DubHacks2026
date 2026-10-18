import { forwardToServer, readJson } from "@/lib/server-proxy";

export async function POST(request: Request) {
  return forwardToServer("/dev/inbound", { body: await readJson(request) });
}
