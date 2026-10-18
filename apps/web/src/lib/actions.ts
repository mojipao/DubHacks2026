"use client";

/** A failed call to one of our /api routes, with the server's status so callers can treat 409 differently. */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ActionError("Network error: the control room can't reach its API", 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new ActionError(data.error ?? `Request failed (${res.status})`, res.status);
  }
  return data;
}

export function approveProposal(
  id: string,
  body?: { editedText?: string; includeLinked?: boolean },
) {
  return post<{ proposals?: unknown[] }>(`/api/proposals/${id}/approve`, body);
}

export function rejectProposal(
  id: string,
  body?: { reason?: string; includeLinked?: boolean },
) {
  return post<{ proposals?: unknown[] }>(`/api/proposals/${id}/reject`, body);
}

export function retryProposal(id: string) {
  return post<{ proposals?: unknown[] }>(`/api/proposals/${id}/retry`);
}

export function simulateInbound(body: { handle: string; name?: string; text: string }) {
  return post<{ conversationId: string; messageId: string }>("/api/dev/inbound", body);
}

export function markPaid(orderId: string) {
  return post<unknown>(`/api/dev/mark-paid/${orderId}`);
}

export function runWinbackScan() {
  return post<{ created: number }>("/api/dev/winback-scan");
}

export function receiveDelivery() {
  return post<{ received: number }>("/api/dev/receive-delivery");
}

export function joinDemo(body: { name: string; handle: string }) {
  return post<{ agentNumber: string; customerId: string; mock?: boolean }>(
    "/api/join",
    body,
  );
}
