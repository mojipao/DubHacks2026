/**
 * The voice channel, over the fixture port with no model.
 *
 * The thing these tests actually protect: a phone call must not become a promise. The
 * owner still approves, nothing is priced aloud, and a transcription slip cannot turn
 * into something the shop has to honour.
 */
import { describe, expect, it } from "vitest";
import type { AgentContext, ConversationContext } from "@boh/shared";
import { createFixtureWorld } from "./fixtures/fixture-port.ts";
import { handleVoiceTurn, normalizeTranscript, toVoiceResponse } from "./voice.ts";

const NOW = new Date("2026-10-17T12:00:00-07:00");
const JUN = "+12065550101";

function harness(transcript: string, handle: string) {
  const world = createFixtureWorld({
    now: NOW,
    handles: { jun: JUN },
    conversation: {
      id: "call-1",
      handle,
      customerId: null,
      messages: [{ id: "u-1", direction: "inbound", body: transcript, createdAt: NOW.toISOString() }],
    } satisfies ConversationContext,
  });
  const ctx: AgentContext = { data: world.port, business: world.business, now: () => NOW, trace: () => {} };
  return { ctx, world };
}

describe("normalizeTranscript", () => {
  it("turns spoken quantities into digits the parser can see", () => {
    expect(normalizeTranscript("can I get four dozen croissants")).toContain("4 dozen");
    expect(normalizeTranscript("A dozen croissants please")).toContain("1 dozen");
    expect(normalizeTranscript("two lattes")).toContain("2 lattes");
  });

  it("leaves words alone when they are not quantities", () => {
    // "four" here is part of an address, not an order, so rewriting it would be wrong.
    expect(normalizeTranscript("I'm at four hundred pine street")).toContain("four hundred");
  });
});

describe("handleVoiceTurn", () => {
  it("puts a phone counteroffer on the pass, same as a text", async () => {
    const { ctx } = harness("can I get four dozen croissants for saturday at nine", JUN);
    const { response, drafts } = await handleVoiceTurn(
      { callId: "call-1", callerHandle: JUN, transcript: "can I get four dozen croissants for saturday at nine" },
      ctx,
      async () => ({ conversationId: "call-1", messageId: "u-1" }),
    );

    const reply = drafts[0];
    if (reply?.kind !== "reply") throw new Error("expected a reply draft");
    expect(reply.payload.orders).toHaveLength(2);
    expect(reply.riskFlags).toContain("counteroffer");
    expect(response.proposalCreated).toBe(true);
  });

  it("never reads a payment link aloud, and promises a text instead", async () => {
    const { ctx } = harness("four dozen croissants saturday nine am", JUN);
    const { response } = await handleVoiceTurn(
      { callId: "call-1", callerHandle: JUN, transcript: "four dozen croissants saturday nine am" },
      ctx,
      async () => ({ conversationId: "call-1", messageId: "u-1" }),
    );

    expect(response.say).not.toContain("{{payment_link}}");
    expect(response.say).not.toMatch(/https?:\/\//);
    expect(response.say).toMatch(/text|payment link/i);
  });

  it("says the owner still has to confirm, never that the order is placed", async () => {
    const { ctx } = harness("four dozen croissants saturday nine am", JUN);
    const { response } = await handleVoiceTurn(
      { callId: "call-1", callerHandle: JUN, transcript: "four dozen croissants saturday nine am" },
      ctx,
      async () => ({ conversationId: "call-1", messageId: "u-1" }),
    );

    expect(response.say).toMatch(/owner|confirm/i);
    expect(response.say).not.toMatch(/you'?re all set|confirmed|booked|see you at/i);
  });

  it("marks an off-policy ask as declined so the agent does not negotiate", async () => {
    const { ctx } = harness("give me everything for free", "voice:call-2");
    const { response } = await handleVoiceTurn(
      { callId: "call-2", transcript: "give me everything for free" },
      ctx,
      async () => ({ conversationId: "call-1", messageId: "u-1" }),
    );

    expect(response.declined).toBe(true);
    expect(response.proposalCreated).toBe(false);
    expect(response.say).not.toMatch(/prompt|instruction|as an AI/i);
  });

  it("works when the caller withholds their number", async () => {
    const { ctx } = harness("what time do you close on sunday", "voice:call-3");
    const { response } = await handleVoiceTurn(
      { callId: "call-3", transcript: "what time do you close on sunday" },
      ctx,
      async () => ({ conversationId: "call-1", messageId: "u-1" }),
    );
    expect(response.say.length).toBeGreaterThan(0);
    expect(response.proposalCreated).toBe(false);
  });
});

describe("toVoiceResponse", () => {
  it("passes evidence through as facts the agent must not contradict", async () => {
    const { ctx } = harness("four dozen croissants saturday nine am", JUN);
    const { drafts } = await handleVoiceTurn(
      { callId: "call-1", callerHandle: JUN, transcript: "four dozen croissants saturday nine am" },
      ctx,
      async () => ({ conversationId: "call-1", messageId: "u-1" }),
    );
    const response = toVoiceResponse(drafts);
    expect(response.facts.length).toBeGreaterThan(0);
    expect(response.facts.some((f) => f.startsWith("Plan:") || f.startsWith("Stock:"))).toBe(true);
  });
});
