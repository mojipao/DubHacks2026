import { handleInbound, runWinbackScan } from "@boh/agents";
import type { HandleInbound, RunWinbackScan } from "@boh/shared";
import { env } from "./env.ts";

/** Canned agent for AGENT_MODE=stub and until @boh/agents lands. Emits trace steps so lane 1 can build the trace UI against real events. */
export const stubHandleInbound: HandleInbound = async ({ conversationId, messageId }, ctx) => {
  const started = Date.now();
  const conversation = await ctx.data.getConversation(conversationId, 10);
  const inbound = conversation.messages.find((m) => m.id === messageId);
  ctx.trace("context", {
    agent: "intake",
    ms: Date.now() - started,
    summary: `Read ${conversation.messages.length} messages from ${conversation.handle}`,
    reads: [{ table: "messages", id: messageId }],
    flags: [],
  });
  ctx.trace("draft", {
    agent: "intake",
    ms: 1,
    summary: "Stub agent: acknowledged the message without an order",
    reads: [],
    flags: ["low_confidence"],
  });

  return [
    {
      kind: "reply",
      agent: "intake",
      title: "Acknowledge message",
      summary: `Stub reply to: ${(inbound?.body ?? "").slice(0, 200)}`,
      rationale: "Stub agent: no real agent is running yet, so it only acknowledges.",
      evidence: [{ label: "Message", value: (inbound?.body ?? "").slice(0, 80), source: { table: "messages", id: messageId } }],
      reads: [{ table: "messages", id: messageId }],
      confidence: 0.5,
      riskFlags: ["low_confidence"],
      payload: { text: "Hi! This is Kettle & Crow Coffee. We got your message and will confirm shortly.", orders: [] },
    },
  ];
};

/** Lane 3's pipeline runs when AGENT_MODE=live. It falls back to deterministic steps when no model key is set. */
export async function loadHandleInbound(): Promise<HandleInbound> {
  return env.AGENT_MODE === "live" ? handleInbound : stubHandleInbound;
}

export async function loadRunWinbackScan(): Promise<RunWinbackScan | null> {
  return runWinbackScan;
}
