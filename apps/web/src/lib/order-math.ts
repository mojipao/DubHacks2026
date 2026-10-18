import type { ReorderPayload, ReplyPayload } from "@boh/shared";
import { INGREDIENT_COSTS, INGREDIENT_NAMES, PRODUCT_NAMES, PRODUCT_PRICES } from "@/lib/business";
import type { UiProposal } from "@/lib/data/types";
import { friendlyPickup } from "@/lib/format";

/** One menu line: what, how many, what it costs. Prices come from the catalog; the server sets the real ones on approve. */
export type MenuLine = { label: string; cents: number };

export type PickupGroup = { when: string; lines: MenuLine[]; discountCents: number };

export function pickupGroups(payload: ReplyPayload): PickupGroup[] {
  return payload.orders.map((o) => {
    const lines = o.items.map((i) => ({
      label: `${i.qty} ${PRODUCT_NAMES[i.productId] ?? i.productId}`,
      cents: (PRODUCT_PRICES[i.productId] ?? 0) * i.qty,
    }));
    const sub = lines.reduce((n, l) => n + l.cents, 0);
    return { when: friendlyPickup(o.pickupAt), lines, discountCents: o.perk === "welcome_back_10" ? Math.round(sub * 0.1) : 0 };
  });
}

export function replyTotal(payload: ReplyPayload): number {
  return pickupGroups(payload).reduce((n, g) => n + g.lines.reduce((m, l) => m + l.cents, 0) - g.discountCents, 0);
}

export function reorderLines(payload: ReorderPayload): MenuLine[] {
  return payload.lines.map((l) => ({
    label: `${l.qty} ${INGREDIENT_NAMES[l.ingredientId]?.unit ?? ""} ${INGREDIENT_NAMES[l.ingredientId]?.name ?? l.ingredientId}`.replace(/\s+/g, " "),
    cents: (INGREDIENT_COSTS[l.ingredientId] ?? 0) * l.qty,
  }));
}

export function reorderTotal(payload: ReorderPayload): number {
  return reorderLines(payload).reduce((n, l) => n + l.cents, 0);
}

/** A ticket and the tickets that only make sense with it (a counteroffer and the restock it needs). */
export type OrderGroup = { lead: UiProposal; linked: UiProposal[] };

/** Groups the active tickets so a linked pair is one decision, newest first. */
export function groupTickets(proposals: UiProposal[], keep: (p: UiProposal) => boolean): OrderGroup[] {
  const active = proposals.filter(keep);
  const ids = new Set(active.map((p) => p.id));
  return active
    .filter((p) => !p.parentProposalId || !ids.has(p.parentProposalId))
    .map((lead) => ({ lead, linked: active.filter((c) => c.parentProposalId === lead.id) }));
}

/** "24 Sat · 24 Sun" for a split, "2 Pistachio maamoul, 1 Adeni chai" for one pickup. */
export function orderSummary(payload: ReplyPayload): string {
  const groups = pickupGroups(payload);
  if (groups.length > 1) {
    return groups.map((g) => `${g.lines.map((l) => l.label.split(" ")[0]).join("+")} ${g.when.split(" ")[0]}`).join(" · ");
  }
  return groups[0]?.lines.map((l) => l.label).join(", ") ?? "";
}

/** Total for the whole decision: the reply's order plus any linked restock. */
export function groupTotals(group: OrderGroup): { customerCents: number; supplierCents: number } {
  let customerCents = 0;
  let supplierCents = 0;
  for (const p of [group.lead, ...group.linked]) {
    if (p.kind === "reply") customerCents += replyTotal(p.payload as ReplyPayload);
    else supplierCents += reorderTotal(p.payload as ReorderPayload);
  }
  return { customerCents, supplierCents };
}
