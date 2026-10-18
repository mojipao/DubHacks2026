import { randomInt } from "node:crypto";
import { OrderDraft, ReorderPayload, ReplyPayload, type Tables } from "@boh/shared";
import { db } from "./db.ts";
import { env } from "./env.ts";
import { logEvent } from "./events.ts";
import { approve, reject, sendAndRecord } from "./execute.ts";
import { answerOwnerText } from "./owner-assistant.ts";

type Proposal = Tables<"proposals">;
type Conversation = Tables<"conversations">;

/** No 0 O 1 I L, so a code read off a phone can't be mistyped. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const HELP = "Reply Y <code> to approve, N <code> to skip, or ? to list what's waiting.";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

async function ownerConversation(): Promise<Conversation | null> {
  const { data } = await db()
    .from("conversations")
    .select("*")
    .eq("role", "owner")
    .order("last_message_at", { ascending: false });
  const list = data ?? [];
  return list.find((c) => c.platform === "imessage" && c.photon_space_id) ?? list[0] ?? null;
}

async function reply(text: string, key: string) {
  const conv = await ownerConversation();
  if (conv) await sendAndRecord(conv, text, key, key);
}

/** Gives a top-level proposal a short code. Retries on the rare collision with the unique index. */
async function assignShortCode(proposalId: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]! + CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]!;
    const { data, error } = await db()
      .from("proposals")
      .update({ short_code: code })
      .eq("id", proposalId)
      .is("short_code", null)
      .select("id");
    if (!error && data.length) return code;
    if (!error) {
      // Already coded: return the stored one rather than a code nobody can use.
      const { data: row } = await db().from("proposals").select("short_code").eq("id", proposalId).single();
      if (row?.short_code) return row.short_code;
      throw new Error(`Proposal ${proposalId} not found`);
    }
    if (error.code !== "23505") throw new Error(`assign short code: ${error.message}`);
  }
  throw new Error("No free short code");
}

/** Server-computed totals so the owner's text never repeats a model's number. */
async function describe(p: Proposal): Promise<string> {
  if (p.kind === "reorder") {
    const payload = ReorderPayload.parse(p.payload);
    const { data } = await db()
      .from("ingredients")
      .select("id, name, unit, unit_cost_cents")
      .in("id", payload.lines.map((l) => l.ingredientId));
    const byId = new Map((data ?? []).map((i) => [i.id, i]));
    const cost = payload.lines.reduce((sum, l) => sum + l.qty * (byId.get(l.ingredientId)?.unit_cost_cents ?? 0), 0);
    const what = payload.lines.map((l) => `${l.qty} ${byId.get(l.ingredientId)?.unit ?? ""} ${byId.get(l.ingredientId)?.name ?? l.ingredientId}`.trim());
    return `a reorder of ${what.join(", ")} from ${payload.supplier} (${money(Math.round(cost))})`;
  }
  const payload = ReplyPayload.parse(p.payload);
  if (!payload.orders.length) return "a reply";
  const ids = [...new Set(payload.orders.flatMap((o: OrderDraft) => o.items.map((i) => i.productId)))];
  const { data } = await db().from("products").select("id, price_cents").in("id", ids);
  const prices = new Map((data ?? []).map((x) => [x.id, x.price_cents]));
  const total = payload.orders.reduce(
    (sum: number, o: OrderDraft) => sum + o.items.reduce((s, i) => s + i.qty * (prices.get(i.productId) ?? 0), 0),
    0,
  );
  const units = payload.orders.reduce((n: number, o: OrderDraft) => n + o.items.reduce((s, i) => s + i.qty, 0), 0);
  const split = payload.orders.length > 1 ? `, split across ${payload.orders.length} pickups` : "";
  return `${units} items${split} (${money(total)})`;
}

/** Called for each new top-level proposal. Always assigns a code; texts the owner only when OWNER_NOTIFY=on and the owner has texted the line. */
export async function notifyOwner(proposalId: string) {
  const { data: p } = await db().from("proposals").select("*").eq("id", proposalId).single();
  if (!p || p.parent_proposal_id) return;
  const code = await assignShortCode(p.id);
  if (env.OWNER_NOTIFY !== "on") return;
  const conv = await ownerConversation();
  if (!conv) return;

  const [{ data: children }, { data: trigger }, customerName] = await Promise.all([
    db().from("proposals").select("*").eq("parent_proposal_id", p.id),
    p.trigger_message_id
      ? db().from("messages").select("body").eq("id", p.trigger_message_id).single()
      : Promise.resolve({ data: null }),
    customerNameFor(p),
  ]);
  const asked = trigger?.body ? `"${trigger.body.slice(0, 120)}"` : "a message";
  const plans = [await describe(p), ...(await Promise.all((children ?? []).map(describe)))];
  const why = p.rationale.trim().replace(/([^.!?])$/, "$1.");
  const text = `${customerName} asked ${asked}. ${why ? `${why} ` : ""}I drafted ${plans.join(" and ")}. Reply Y ${code} to approve all, N ${code} to skip.`;

  await sendAndRecord(conv, text, p.id, `notify:${p.id}`);
  await db().from("proposals").update({ owner_notified_at: new Date().toISOString() }).eq("id", p.id);
  await logEvent("system", "owner.notified", { type: "proposal", id: p.id }, { code });
}

async function customerNameFor(p: Proposal): Promise<string> {
  if (!p.conversation_id) return "A customer";
  const { data } = await db().from("conversations").select("handle, customers(name)").eq("id", p.conversation_id).single();
  return data?.customers?.name ?? "A new customer";
}

/** `Y [code]`, `N [code]`, `?`. Without a code, applies to the most recently notified pending proposal. */
export async function handleOwnerCommand(text: string, messageId: string) {
  const match = /^\s*([YN?])(?:\s+([A-Z0-9]{2}))?\s*$/i.exec(text);
  const verb = match?.[1]?.toUpperCase();
  const key = `owner-reply:${messageId}`;

  if (!match || !verb) {
    // Not a ticket command: stock questions, texts to customers, calls.
    const answer = await answerOwnerText(text).catch((err) => `Couldn't do that: ${err instanceof Error ? err.message : String(err)}`);
    await logEvent("owner", "owner.command", null, { command: answer ? "assistant" : "unknown", text: text.slice(0, 80) });
    return reply(answer ?? `${HELP} You can also ask "how's our stock?" or "text regulars: …".`, key);
  }

  if (verb === "?") {
    const { data } = await db()
      .from("proposals")
      .select("short_code, title, summary")
      .eq("status", "pending")
      .is("parent_proposal_id", null)
      .order("created_at", { ascending: false })
      .limit(5);
    await logEvent("owner", "owner.command", null, { command: "list", count: data?.length ?? 0 });
    const lines = (data ?? []).map((p) => `${p.short_code ?? "--"}: ${p.title}`);
    return reply(lines.length ? `Waiting on you:\n${lines.join("\n")}\n${HELP}` : "Nothing waiting. The pass is clear.", key);
  }

  const code = match[2]?.toUpperCase();
  const query = db().from("proposals").select("*").eq("status", "pending").is("parent_proposal_id", null);
  const { data: targets } = code
    ? await query.eq("short_code", code).limit(1)
    : await query.not("owner_notified_at", "is", null).order("owner_notified_at", { ascending: false }).limit(1);
  const target = targets?.[0];
  if (!target) {
    await logEvent("owner", "owner.command", null, { command: verb === "Y" ? "approve" : "reject", code, found: false });
    return reply(code ? `Nothing pending with code ${code}. ${HELP}` : `Nothing pending. ${HELP}`, key);
  }

  const opts = { includeLinked: true, actor: "owner" as const, via: "imessage" as const };
  await logEvent("owner", "owner.command", { type: "proposal", id: target.id }, { command: verb === "Y" ? "approve" : "reject", code });
  try {
    if (verb === "N") {
      await reject(target.id, opts);
      return reply(`Skipped ${target.short_code}.`, key);
    }
    const results = await approve(target.id, opts);
    const name = await customerNameFor(target);
    const done = results.map((r) => (r.kind === "reorder" ? `reorder ${r.status === "executed" ? "placed" : r.status}` : `sent to ${name} ${r.status === "executed" ? "✓" : `(${r.status})`}`));
    return reply(done.join(" · "), key);
  } catch (err) {
    return reply(`Couldn't finish ${target.short_code}: ${err instanceof Error ? err.message : String(err)}`, key);
  }
}
