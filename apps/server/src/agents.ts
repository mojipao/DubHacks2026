import type { HandleInbound } from "@boh/shared";
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
      payload: { text: "Hi! This is Larch & Rye. We got your message and will confirm shortly.", orders: [] },
    },
  ];
};

/** Lane 3's package replaces the stub when AGENT_MODE=live. */
export async function loadHandleInbound(): Promise<HandleInbound> {
  if (env.AGENT_MODE === "live") {
    try {
      const pkg = "@boh/agents";
      const mod = (await import(pkg)) as { handleInbound?: HandleInbound };
      if (mod.handleInbound) return mod.handleInbound;
    } catch {
      console.warn("AGENT_MODE=live but @boh/agents is not installed; using the stub agent");
    }
  }
  return stubHandleInbound;
}
