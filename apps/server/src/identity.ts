import { db } from "./db.ts";
import { logEvent } from "./events.ts";

const PLACEHOLDERS = new Set(["new customer", "guest", "unknown", "caller", "customer"]);
const REJECT = /^(yes|yeah|yep|yup|no|nope|nah|hi|hey|hello|ok|okay|k|thanks|thank you|please|the usual|sure|correct|right)$/i;
const ORDERISH = /\b(dozen|cake|chai|coffee|latte|qishr|maamoul|pickup|pick up|order|saturday|sunday|tomorrow|today|menu|hours?)\b/i;

function asHandle(handle: string): string {
  const h = handle.trim();
  return h.includes("@") ? h.toLowerCase() : h.replace(/[^\d+]/g, "");
}

function lookupKeys(handle: string): string[] {
  const n = asHandle(handle);
  const d = n.replace(/\D/g, "");
  const e164 = d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : n.startsWith("+") ? n : d ? `+${d}` : n;
  return [...new Set([n, e164, d, d ? `+${d}` : ""].filter(Boolean))];
}

/** True when we do not yet have a real given name on file. */
export function isUnnamed(name: string | null | undefined): boolean {
  if (!name) return true;
  const n = name.trim().toLowerCase();
  return !n || PLACEHOLDERS.has(n) || /^\+?\d[\d\s().-]{6,}$/.test(n);
}

/** Title-case a 1–4 word given name. */
function tidyName(raw: string, opts: { trusted?: boolean } = {}): string | null {
  const words = raw
    .trim()
    .replace(/[.!?,]+$/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const max = opts.trusted ? 5 : 3;
  if (words.length < 1 || words.length > max) return null;
  if (words.some((w) => w.length > 24 || /\d/.test(w))) return null;
  const joined = words.join(" ");
  if (!opts.trusted && (REJECT.test(joined) || ORDERISH.test(joined))) return null;
  if (!words.every((w) => /^[a-zA-Z][a-zA-Z'’\-]*$/.test(w))) return null;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

/**
 * Pulls a given name out of a customer utterance: "I'm Alex", "this is Priya Raman",
 * or a bare 1–3 word reply after we asked.
 */
export function parseGivenName(text: string, opts: { theyWereAsked?: boolean } = {}): string | null {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return null;
  const intro =
    /^(?:hi|hey|hello)[,.]?\s+(?:i(?:['’]m| am)|this is|my name is|it['’]?s)\s+(.+)$/i.exec(t) ??
    /^(?:i(?:['’]m| am)|this is|my name is|it['’]?s)\s+(.+)$/i.exec(t);
  if (intro) return tidyName(intro[1] ?? "");
  if (opts.theyWereAsked) return tidyName(t);
  // A first text that is only a name, with no order words.
  if (!ORDERISH.test(t) && t.split(/\s+/).length <= 3) return tidyName(t);
  return null;
}

/** Last shop text in this thread asked for a name. */
export async function weAskedForName(conversationId: string): Promise<boolean> {
  const { data } = await db()
    .from("messages")
    .select("body")
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(6);
  return (data ?? []).some((m) => /your name|can i (?:get|have) your name|who am i speaking/i.test(m.body));
}

export async function conversationNeedsName(conversationId: string): Promise<boolean> {
  const { data } = await db().from("conversations").select("customers(name)").eq("id", conversationId).maybeSingle();
  const row = data as { customers?: { name?: string } | null } | null;
  return isUnnamed(row?.customers?.name);
}

export function withNameAsk(text: string): string {
  if (/your name/i.test(text)) return text;
  return `What's your name?\n\n${text}`;
}

/** The iMessage thread we can actually deliver to for this phone, if they have texted the shop. */
export async function imessageThread(handle: string) {
  const { data } = await db()
    .from("conversations")
    .select("*")
    .in("handle", lookupKeys(handle))
    .eq("platform", "imessage");
  return (data ?? []).find((c) => c.photon_space_id && c.photon_agent_user_id) ?? null;
}

export async function findCustomerId(handle: string): Promise<string | null> {
  const { data } = await db().from("customers").select("id").in("handle", lookupKeys(handle)).maybeSingle();
  return data?.id ?? null;
}

export async function ensureCustomer(handle: string): Promise<string> {
  const existing = await findCustomerId(handle);
  if (existing) return existing;
  const { data, error } = await db()
    .from("customers")
    .insert({ name: "New customer", handle: asHandle(handle) })
    .select("id")
    .single();
  if (error) throw new Error(`insert customer: ${error.message}`);
  return data.id;
}

export async function rememberCustomerName(
  handle: string,
  rawName: string,
  conversationId?: string | null,
  opts: { trusted?: boolean } = {},
): Promise<{ customerId: string; name: string } | null> {
  const name = tidyName(rawName, opts);
  if (!name) return null;
  const keys = lookupKeys(handle);
  const { data: existing } = await db().from("customers").select("id, name, handle, is_demo_persona").in("handle", keys).maybeSingle();
  let customerId: string;
  let stored = name;
  if (existing) {
    customerId = existing.id;
    if (existing.is_demo_persona) {
      stored = existing.name;
    } else if (isUnnamed(existing.name)) {
      await db().from("customers").update({ name }).eq("id", existing.id);
    } else {
      stored = existing.name;
    }
  } else {
    const { data, error } = await db()
      .from("customers")
      .insert({ name, handle: asHandle(handle) })
      .select("id")
      .single();
    if (error) throw new Error(`remember name: ${error.message}`);
    customerId = data.id;
  }
  if (conversationId) {
    await db().from("conversations").update({ customer_id: customerId }).eq("id", conversationId);
  } else {
    await db().from("conversations").update({ customer_id: customerId }).in("handle", keys).eq("role", "customer").is("customer_id", null);
  }
  await logEvent("system", "customer.named", { type: "customer", id: customerId }, { name: stored, handle: keys[0] });
  return { customerId, name: stored };
}

/** Guess a name from a finished call's turns (the agent asked, then they answered). */
export function nameFromCallTurns(turns: { role: string; message: string | null }[]): string | null {
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (!t || t.role !== "user" || !t.message) continue;
    const prev = i > 0 ? turns[i - 1] : undefined;
    const asked = Boolean(prev && prev.role === "agent" && /your name|who am i speaking|can i get your name/i.test(prev.message ?? ""));
    const parsed = parseGivenName(t.message, { theyWereAsked: asked });
    if (parsed) return parsed;
  }
  return null;
}
