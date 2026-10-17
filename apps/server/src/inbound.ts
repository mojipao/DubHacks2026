import { ProposalDraft, type AgentContext, type Json } from "@boh/shared";
import { loadHandleInbound } from "./agents.ts";
import { business } from "./business.ts";
import { supabaseDataPort } from "./data-port.ts";
import { db } from "./db.ts";
import { env } from "./env.ts";
import { logEvent, type Actor, type Subject } from "./events.ts";
import { handleOwnerCommand, notifyOwner } from "./owner.ts";

export interface InboundMessage {
  platform: "imessage" | "simulated";
  handle: string;
  name?: string;
  text: string;
  photon?: { spaceId: string; agentUserId: string; messageId: string };
}

const DEBOUNCE_MS = 4000;
const GUARD_FLAGS = new Set(["injection_suspected", "off_policy", "abusive"]);
const pending = new Map<string, { timer: NodeJS.Timeout; messageId: string }>();

/** Phones keep their E.164 form; iMessage emails compare case-insensitively. */
export function normalizeHandle(handle: string): string {
  const h = handle.trim();
  return h.includes("@") ? h.toLowerCase() : h.replace(/[^\d+]/g, "");
}

/** "+12065550100" → "+1 206 •••• 0100"; emails keep the first letter and the domain. */
export function maskHandle(handle: string): string {
  const h = normalizeHandle(handle);
  if (h.includes("@")) return h.replace(/^(.).*(@.*)$/, "$1•••$2");
  return h.length >= 10 ? `${h.slice(0, 2)} ${h.slice(2, 5)} •••• ${h.slice(-4)}` : "••••";
}

/** Stores one inbound message and schedules the agents. Returns null for a redelivered Photon message. */
export async function ingestInbound(input: InboundMessage): Promise<{ conversationId: string; messageId: string } | null> {
  const handle = normalizeHandle(input.handle);
  const isOwner = Boolean(env.OWNER_HANDLE) && handle === normalizeHandle(env.OWNER_HANDLE!);
  const customerId = isOwner ? null : await findOrCreateCustomer(handle, input.name);
  const conversationId = await upsertConversation(input, handle, customerId, isOwner);

  const { data: message, error } = await db()
    .from("messages")
    .insert({
      conversation_id: conversationId,
      direction: "inbound",
      body: input.text,
      photon_message_id: input.photon?.messageId ?? null,
      status: "received",
    })
    .select("id")
    .single();
  if (error?.code === "23505") return null;
  if (error) throw new Error(`insert message: ${error.message}`);
  // Arm the debounce before the slower bookkeeping so a burst of texts collapses into one run.
  if (!isOwner) schedule(conversationId, message.id);

  await db().from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  await logEvent(isOwner ? "owner" : "customer", "message.received", { type: "message", id: message.id }, {
    conversationId,
    platform: input.platform,
  });

  // The owner's texts go to the command parser, never to the agents. Hard equality on the normalized handle.
  if (isOwner) {
    await handleOwnerCommand(input.text, message.id);
    return { conversationId, messageId: message.id };
  }

  await supersedePendingReplies(conversationId);
  return { conversationId, messageId: message.id };
}

async function findOrCreateCustomer(handle: string, name?: string): Promise<string | null> {
  const { data: existing } = await db().from("customers").select("id").eq("handle", handle).maybeSingle();
  if (existing) return existing.id;
  if (!name) return null;
  const { data, error } = await db().from("customers").insert({ name, handle }).select("id").single();
  if (error) throw new Error(`insert customer: ${error.message}`);
  return data.id;
}

async function upsertConversation(input: InboundMessage, handle: string, customerId: string | null, isOwner: boolean) {
  const query = db().from("conversations").select("id, customer_id");
  const { data: existing } = input.photon
    ? await query.eq("photon_space_id", input.photon.spaceId).maybeSingle()
    : await query.eq("handle", handle).eq("platform", input.platform).maybeSingle();
  if (existing) {
    if (!existing.customer_id && customerId) {
      await db().from("conversations").update({ customer_id: customerId }).eq("id", existing.id);
    }
    return existing.id;
  }
  const { data, error } = await db()
    .from("conversations")
    .insert({
      handle,
      customer_id: customerId,
      role: isOwner ? "owner" : "customer",
      platform: input.platform,
      photon_space_id: input.photon?.spaceId ?? null,
      photon_agent_user_id: input.photon?.agentUserId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`insert conversation: ${error.message}`);
  return data.id;
}

async function supersedePendingReplies(conversationId: string) {
  const { data } = await db()
    .from("proposals")
    .update({ status: "superseded", decided_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("kind", "reply")
    .eq("status", "pending")
    .select("id");
  for (const p of data ?? []) await logEvent("system", "proposal.superseded", { type: "proposal", id: p.id });
}

/** A burst of texts becomes one agent run on the latest message. */
function schedule(conversationId: string, messageId: string) {
  const prior = pending.get(conversationId);
  if (prior) clearTimeout(prior.timer);
  const timer = setTimeout(() => {
    pending.delete(conversationId);
    runAgents(conversationId, messageId).catch((err) => console.error("runAgents failed", err));
  }, DEBOUNCE_MS);
  pending.set(conversationId, { timer, messageId });
}

/** Agent context whose trace calls become `agent.step` events on the subject. Await `flush` before reading the trace back. */
export function agentContext(subject: Subject | null): { ctx: AgentContext; flush: () => Promise<unknown> } {
  const traceWrites: Promise<void>[] = [];
  const ctx: AgentContext = {
    data: supabaseDataPort,
    business,
    now: () => new Date(),
    trace: (step, detail) => {
      const agent = typeof detail.agent === "string" ? detail.agent : "intake";
      traceWrites.push(
        logEvent(`agent:${agent}` as Actor, "agent.step", subject, { ...detail, agent, step }).catch((err) =>
          console.error("trace write failed", err),
        ),
      );
    },
  };
  return { ctx, flush: () => Promise.all(traceWrites) };
}

async function runAgents(conversationId: string, messageId: string) {
  const subject = { type: "message", id: messageId };
  const { ctx, flush } = agentContext(subject);

  let drafts: unknown[];
  try {
    const handleInbound = await loadHandleInbound();
    drafts = await handleInbound({ conversationId, messageId }, ctx);
  } catch (err) {
    await flush();
    await logEvent("agent:intake", "agent.step", subject, { agent: "intake", step: "error", error: String(err) });
    return;
  }
  await flush();
  if (await hasNewerInbound(conversationId, messageId)) {
    await logEvent("system", "agent.step", subject, { agent: "intake", step: "discard", summary: "A newer message arrived; drafts dropped" });
    return;
  }
  await storeDrafts(drafts, conversationId, messageId);
}

/** A run that finishes after a newer text arrived would leave a stale ticket beside the new one. */
async function hasNewerInbound(conversationId: string, messageId: string) {
  const { data } = await db()
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data?.id !== messageId;
}

/** Validates and stores agent drafts as pending proposals. Returns the stored IDs in input order (null when invalid). */
export async function storeDrafts(raw: unknown[], conversationId: string | null, messageId: string | null) {
  const ids: (string | null)[] = [];
  const parents: (number | undefined)[] = [];

  for (const candidate of raw) {
    const parsed = ProposalDraft.safeParse(candidate);
    if (!parsed.success) {
      ids.push(null);
      parents.push(undefined);
      await logEvent("agent:intake", "agent.step", messageId ? { type: "message", id: messageId } : null, {
        agent: "intake",
        step: "validate",
        error: parsed.error.message,
      });
      continue;
    }
    const d = parsed.data;
    const { data, error } = await db()
      .from("proposals")
      .insert({
        agent: d.agent,
        kind: d.kind,
        conversation_id: conversationId,
        trigger_message_id: messageId,
        title: d.title,
        summary: d.summary,
        rationale: d.rationale,
        payload: d.payload as Json,
        evidence: d.evidence as Json,
        reads: d.reads as Json,
        confidence: d.confidence,
        risk_flags: d.riskFlags,
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert proposal: ${error.message}`);
    ids.push(data.id);
    parents.push(d.parentIndex);

    await logEvent(`agent:${d.agent}` as Actor, "proposal.created", { type: "proposal", id: data.id }, { kind: d.kind });
    const guardFlags = d.riskFlags.filter((f) => GUARD_FLAGS.has(f));
    if (guardFlags.length) {
      await logEvent("agent:guard", "guard.flagged", { type: "proposal", id: data.id }, { flags: guardFlags });
    }
  }

  // Second pass so a draft may point at a parent anywhere in the array.
  for (const [i, parentIndex] of parents.entries()) {
    const id = ids[i];
    const parentId = parentIndex === undefined ? null : ids[parentIndex];
    if (id && parentId) await db().from("proposals").update({ parent_proposal_id: parentId }).eq("id", id);
  }

  for (const [i, id] of ids.entries()) {
    if (id && parents[i] === undefined) await notifyOwner(id).catch((err) => console.error("notifyOwner failed", err));
  }
  return ids;
}
