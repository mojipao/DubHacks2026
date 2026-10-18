import { getFromServer } from "@/lib/server-proxy";

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  return getFromServer(`/contacts${search}`);
}
