import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const serverUrl = process.env.SERVER_URL ?? "http://localhost:8787";
  const token = process.env.OWNER_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "OWNER_TOKEN is not configured on the web server" },
      { status: 500 },
    );
  }

  const res = await fetch(`${serverUrl}/dev/inbound`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-owner-token": token,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({ error: "Invalid server response" }));
  return NextResponse.json(data, { status: res.status });
}
