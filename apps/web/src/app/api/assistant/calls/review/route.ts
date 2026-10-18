import { forwardToServer, readJson } from "@/lib/server-proxy";

/** Owner marked a transcribed call reviewed or skipped. */
export async function POST(request: Request) {
  return forwardToServer("/assistant/calls/review", { body: await readJson(request) });
}
