import type { ReplyPayload } from "@boh/shared";
import { BUSINESS } from "@/lib/business";
import type { FrictionStats, UiEvent, UiProposal } from "@/lib/data/types";

/** Friction counters since the last `demo.reset`, exactly as "Friction saved" in planning/ARCHITECTURE.md. */
export function computeFriction(
  events: Pick<UiEvent, "type" | "subjectId" | "data">[],
  proposals: Map<string, Pick<UiProposal, "kind" | "payload" | "riskFlags">>,
): FrictionStats {
  const m = BUSINESS.minutesSaved;
  const f: FrictionStats = {
    messagesHandled: 0,
    ordersCreated: 0,
    reordersDrafted: 0,
    guardCatches: 0,
    ownerMinutesSaved: 0,
  };
  for (const e of events) {
    if (e.type === "order.created") f.ordersCreated += 1;
    if (e.type === "guard.flagged") {
      f.guardCatches += 1;
      f.ownerMinutesSaved += m.guardCatch;
    }
    if (e.type === "proposal.created") {
      const kind = e.data.kind ?? (e.subjectId ? proposals.get(e.subjectId)?.kind : null);
      if (kind === "reorder") f.reordersDrafted += 1;
    }
    if (e.type === "proposal.executed" && e.subjectId) {
      const p = proposals.get(e.subjectId);
      const kind = p?.kind ?? e.data.kind;
      if (kind === "reorder") {
        f.ownerMinutesSaved += m.reorder;
      } else if (kind === "reply") {
        f.messagesHandled += 1;
        const orders = p ? ((p.payload as ReplyPayload).orders ?? []) : [];
        if (orders.length >= 2 || p?.riskFlags.includes("counteroffer")) {
          f.ownerMinutesSaved += m.counteroffer;
        } else {
          f.ownerMinutesSaved += m.reply + orders.length * m.order;
        }
      }
    }
  }
  return f;
}
