import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const serverUrl = process.env.SERVER_URL ?? "http://localhost:8787";

  try {
    const res = await fetch(`${serverUrl}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ error: "Invalid server response" }));
    if (res.ok) return NextResponse.json(data, { status: res.status });

    // Fallback mock while lane 2 /join is not live
    if (res.status === 404 || res.status >= 500) {
      return NextResponse.json({
        agentNumber: "+12065550111",
        customerId: "mock-customer",
        mock: true,
      });
    }
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({
      agentNumber: "+12065550111",
      customerId: "mock-customer",
      mock: true,
    });
  }
}
