import { forwardToServer } from "@/lib/server-proxy";

/** Pulls finished phone calls now instead of waiting for the server's next sync. */
export async function POST() {
  return forwardToServer("/assistant/calls/sync");
}
