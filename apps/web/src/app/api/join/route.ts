import { NextResponse } from "next/server";
import { clientIpHeaders, forwardToServer, readJson } from "@/lib/server-proxy";

export async function POST(request: Request) {
  const body = await readJson(request);
  // Only the explicit mock flag may invent a number. Unset/production must hit Photon,
  // or a judge is handed a fake 555 line and texts SMS that the shop never sees.
  if (process.env.NEXT_PUBLIC_DATA_MODE === "mock") {
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
