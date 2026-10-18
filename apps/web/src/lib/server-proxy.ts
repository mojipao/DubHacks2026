import { NextResponse } from "next/server";

/** Forwards an owner action to the Hono server with the token, which never reaches the browser. */
export async function forwardToServer(
  path: string,
  init: { body?: unknown; owner?: boolean; headers?: Record<string, string> } = {},
) {
  const serverUrl = process.env.SERVER_URL ?? "http://localhost:8787";
  const token = process.env.OWNER_TOKEN;
  const owner = init.owner ?? true;

  if (owner && !token) {
    return NextResponse.json(
      { error: "OWNER_TOKEN is not configured on the web server" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${serverUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(owner && token ? { "x-owner-token": token } : {}),
        ...init.headers,
      },
      body: JSON.stringify(init.body ?? {}),
      cache: "no-store",
    });
    const data = await res
      .json()
      .catch(() => ({ error: `Server answered ${res.status} without JSON` }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: `Can't reach the server at ${serverUrl}` },
      { status: 502 },
    );
  }
}

export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => ({}));
}

/** The judge's own IP, so the server's per-IP /join rate limit doesn't lump every judge behind this proxy together. */
export function clientIpHeaders(request: Request): Record<string, string> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;
  return ip ? { "x-forwarded-for": ip } : {};
}

/** GET an owner route; JSON comes back as JSON, anything else (the leads CSV) streams through with its headers. */
export async function getFromServer(pathWithQuery: string) {
  const serverUrl = process.env.SERVER_URL ?? "http://localhost:8787";
  const token = process.env.OWNER_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "OWNER_TOKEN is not configured on the web server" }, { status: 500 });
  }
  try {
    const res = await fetch(`${serverUrl}${pathWithQuery}`, {
      headers: { "x-owner-token": token },
      cache: "no-store",
    });
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      return NextResponse.json(await res.json(), { status: res.status });
    }
    const headers = new Headers({ "content-type": type || "text/plain" });
    const disposition = res.headers.get("content-disposition");
    if (disposition) headers.set("content-disposition", disposition);
    return new NextResponse(await res.text(), { status: res.status, headers });
  } catch {
    return NextResponse.json({ error: `Can't reach the server at ${serverUrl}` }, { status: 502 });
  }
}
