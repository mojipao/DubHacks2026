/**
 * The voice channel's entry point into the bakery brain.
 *
 * ElevenLabs runs the live conversation over Photon's SIP line. It does not know
 * Saturday's croissant capacity, so mid-call it calls a tool on our server, and that
 * tool lands here. Everything after this point is the pipeline the texts already use,
 * which is the whole idea: a phone order produces the same ticket on the same pass,
 * waiting on the same owner approval.
 *
 * What this file does NOT do, deliberately:
 * - It does not send, charge, or commit. A call produces a proposal, nothing more.
 * - It does not speak. It returns facts for ElevenLabs to say in its own voice, so
 *   there is exactly one place (the Guard) deciding what may be said to a customer.
 */
import { z } from "zod";
import type { AgentContext, ProposalDraft } from "@boh/shared";
import { handleInbound } from "./intake.ts";

/**
 * The tool payload ElevenLabs sends mid-call.
 *
 * `transcript` is what the caller said, as speech-to-text heard it — so it arrives
 * messier than a text message: no punctuation, homophones, and "four dozen" rather
 * than "4 dozen". The understand step already copes with that, which is why this
 * hands over the raw transcript rather than trying to clean it up here.
 */
export const VoiceToolRequest = z.object({
  /** Stable per call, so repeated tool calls in one conversation share a thread. */
  callId: z.string().min(1),
  /** The caller's number in E.164, when the carrier provides it. */
  callerHandle: z.string().optional(),
  /** What the caller said. */
  transcript: z.string().min(1),
  /** A name the agent collected earlier in the call, if any. */
  callerName: z.string().optional(),
});
export type VoiceToolRequest = z.infer<typeof VoiceToolRequest>;

/**
 * What ElevenLabs gets back. Plain data, phrased for speech.
 *
 * `say` is a suggestion the voice agent may reword; `facts` are the things it must not
 * contradict. Keeping them separate means a transcription slip cannot turn into a
 * promise the shop has to honour.
 */
export interface VoiceToolResponse {
  /** One or two sentences, already Guard-checked, safe to read aloud verbatim. */
  say: string;
  /** True when a proposal was created and is now waiting on the owner. */
  proposalCreated: boolean;
  /** Short codes the owner will see, so the agent can say "I've sent that over". */
  proposalIds: string[];
  /** Verified facts the agent may use but must not embellish. */
  facts: string[];
  /** Set when the caller asked for something we decline; the agent should not negotiate. */
  declined?: boolean;
}

/** Spoken numbers, because speech-to-text writes words where a text would have digits. */
const SPOKEN_NUMBERS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6",
  seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12",
  twenty: "20", thirty: "30", forty: "40", fifty: "50",
};

/**
 * Light normalisation of a spoken transcript.
 *
 * Only the transformations that are unambiguous. "four dozen" has to become "4 dozen"
 * for the quantity parser to see it, but anything cleverer risks changing what the
 * caller actually asked for, and the model handles the rest.
 */
export function normalizeTranscript(raw: string): string {
  let text = raw.trim().toLowerCase();
  for (const [word, digit] of Object.entries(SPOKEN_NUMBERS)) {
    text = text.replace(new RegExp(`\\b${word}\\b(?=\\s+(dozen|of|croissants?|loaves|lattes?|coffees?))`, "g"), digit);
  }
  // "a dozen" reads as one dozen; the quantity parser already understands "1 dozen".
  text = text.replace(/\ba dozen\b/g, "1 dozen");
  return text;
}

/**
 * Runs one caller utterance through the normal pipeline.
 *
 * `storeInbound` is the server's: it records the utterance as an inbound message on a
 * voice conversation and returns the ids, exactly as it does for an iMessage. Passing
 * it in keeps this package free of any database client, which is rule 1 in
 * `planning/ARCHITECTURE.md`.
 */
export async function handleVoiceTurn(
  request: VoiceToolRequest,
  ctx: AgentContext,
  storeInbound: (input: {
    callId: string;
    handle: string;
    name?: string;
    text: string;
  }) => Promise<{ conversationId: string; messageId: string }>,
): Promise<{ response: VoiceToolResponse; drafts: ProposalDraft[] }> {
  const text = normalizeTranscript(request.transcript);

  const { conversationId, messageId } = await storeInbound({
    callId: request.callId,
    // A withheld caller id still needs a stable handle for the conversation.
    handle: request.callerHandle ?? `voice:${request.callId}`,
    name: request.callerName,
    text,
  });

  const drafts = await handleInbound({ conversationId, messageId }, ctx);
  return { response: toVoiceResponse(drafts), drafts };
}

/** Turns drafts into something safe to say out loud. */
export function toVoiceResponse(drafts: ProposalDraft[]): VoiceToolResponse {
  const reply = drafts.find((d) => d.kind === "reply");
  const replyDraft = reply?.kind === "reply" ? reply : null;
  const flags = new Set(drafts.flatMap((d) => d.riskFlags));
  const declined = flags.has("off_policy") || flags.has("injection_suspected") || flags.has("abusive");

  const facts: string[] = [];
  for (const row of replyDraft?.evidence ?? []) facts.push(`${row.label}: ${row.value}`);

  const orders = replyDraft?.payload.orders ?? [];
  const proposalCreated = orders.length > 0;

  return {
    say: speakable(replyDraft?.payload.text ?? "", { proposalCreated, declined, split: orders.length > 1 }),
    proposalCreated,
    proposalIds: [],
    facts,
    ...(declined ? { declined: true } : {}),
  };
}

/**
 * Rewrites a drafted text message as something a person would say on the phone.
 *
 * The payment link is the main difference: there is nothing to tap during a call, so
 * the agent says the link is coming by text instead of reading a URL aloud. The
 * approval promise also has to stay honest — the owner has not approved anything yet,
 * so the agent says it is going over for confirmation, never "you're all set".
 */
function speakable(text: string, opts: { proposalCreated: boolean; declined: boolean; split: boolean }): string {
  let spoken = text
    .replace(/\{\{payment_link\}\}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (opts.proposalCreated) {
    spoken += opts.split
      ? " I'll send that over to the owner to confirm, and you'll get a text with the payment link for both days."
      : " I'll send that over to the owner to confirm, and you'll get a text with the payment link.";
  }

  // A draft that could not be made into an order should not sound like one was.
  if (!opts.proposalCreated && !opts.declined && spoken.length === 0) {
    spoken = "Let me take that down for the owner and we'll get back to you shortly.";
  }

  return spoken.trim();
}
