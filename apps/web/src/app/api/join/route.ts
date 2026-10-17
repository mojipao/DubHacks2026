import { NextResponse } from "next/server";
import { clientIpHeaders, forwardToServer, readJson } from "@/lib/server-proxy";

export async function POST(request: Request) {
  const body = await readJson(request);
  // Mock mode never touches Photon; live mode passes the server's real errors through so a judge is never handed a fake number.
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "live") {
    return NextResponse.json({
      agentNumber: "+12065550111",
      customerId: "mock-customer",
      mock: true,
    });
  }
  return forwardToServer("/join", {
    body,
    owner: false,
    headers: clientIpHeaders(request),
  });
}
