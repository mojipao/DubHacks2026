import { ProposalDraft } from "@boh/shared";
import { loadRunWinbackScan } from "./agents.ts";
import { db } from "./db.ts";
import { logEvent } from "./events.ts";
import { agentContext, storeDrafts } from "./inbound.ts";

/** The customer a win-back draft is for: the first `customers` record it read. */
function customerOf(draft: ProposalDraft): string | null {
  return (
    draft.reads.find((r) => r.table === "customers")?.id ??
    draft.evidence.find((e) => e.source?.table === "customers")?.source?.id ??
    null
  );
}

/**
 * Shared Photon lines can't start conversations. A customer with an iMessage space gets the
 * reply there; anyone else gets a simulated conversation, so approval executes without sending.
 */
async function conversationFor(customerId: string): Promise<string> {
  const { data: live } = await db()
    .from("conversations")
    .select("id")
    .eq("customer_id", customerId)
    .eq("platform", "imessage")
    .not("photon_space_id", "is", null)
    .order("last_message_at", { ascending: false })
    .limit(1);
  if (live?.[0]) return live[0].id;

  const { data: customer } = await db().from("customers").select("handle").eq("id", customerId).single();
  const handle = customer?.handle ?? `customer:${customerId}`;
  const { data: sim } = await db()
    .from("conversations")
    .select("id")
    .eq("handle", handle)
    .eq("platform", "simulated")
    .maybeSingle();
  if (sim) return sim.id;
  const { data, error } = await db()
    .from("conversations")
    .insert({ handle, customer_id: customerId, platform: "simulated" })
    .select("id")
    .single();
  if (error) throw new Error(`create win-back conversation: ${error.message}`);
  return data.id;
}

export async function runWinback(): Promise<{ created: number; available: boolean }> {
  const scan = await loadRunWinbackScan();
  if (!scan) return { created: 0, available: false };

  const { ctx, flush } = agentContext(null);
  const drafts = await scan(ctx);
  await flush();

  let created = 0;
  for (const raw of drafts) {
    const parsed = ProposalDraft.safeParse(raw);
    const customerId = parsed.success ? customerOf(parsed.data) : null;
    if (!customerId) {
      await logEvent("agent:winback", "agent.step", null, { agent: "winback", step: "validate", error: "draft names no customer in reads" });
      continue;
    }
    const ids = await storeDrafts([raw], await conversationFor(customerId), null);
    created += ids.filter(Boolean).length;
  }
  await logEvent("system", "winback.scanned", null, { candidates: drafts.length, created });
  return { created, available: true };
}
