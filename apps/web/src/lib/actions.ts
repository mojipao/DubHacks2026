"use client";

export async function approveProposal(
  id: string,
  body?: { editedText?: string; includeLinked?: boolean },
) {
  const res = await fetch(`/api/proposals/${id}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error((data as { error?: string }).error ?? "Approve failed"), {
      status: res.status,
    });
  }
  return data;
}

export async function rejectProposal(
  id: string,
  body?: { reason?: string; includeLinked?: boolean },
) {
  const res = await fetch(`/api/proposals/${id}/reject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error((data as { error?: string }).error ?? "Reject failed"), {
      status: res.status,
    });
  }
  return data;
}

export async function simulateInbound(body: {
  handle: string;
  name?: string;
  text: string;
}) {
  const res = await fetch("/api/dev/inbound", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Inbound failed");
  }
  return data;
}

export async function joinDemo(body: { name: string; handle: string }) {
  const res = await fetch("/api/join", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Join failed");
  }
  return data as { agentNumber: string; customerId: string };
}
