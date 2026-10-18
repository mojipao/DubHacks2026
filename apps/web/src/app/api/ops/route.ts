import { getFromServer } from "@/lib/server-proxy";

export async function GET() {
  return getFromServer("/ops");
}
