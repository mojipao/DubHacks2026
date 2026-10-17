import { forwardToServer } from "@/lib/server-proxy";

export async function POST() {
  return forwardToServer("/dev/winback-scan");
}
