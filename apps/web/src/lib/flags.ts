import type { RiskFlag } from "@boh/shared";

export type FlagMeta = {
  label: string;
  tone: "tomato" | "amber" | "muted";
};

const LABELS: Record<RiskFlag, FlagMeta> = {
  new_customer: { label: "New customer", tone: "amber" },
  low_confidence: { label: "Low confidence", tone: "amber" },
  large_order: { label: "Large order", tone: "amber" },
  capacity_shortfall: { label: "Over capacity", tone: "tomato" },
  ingredient_shortfall: { label: "Short on stock", tone: "tomato" },
  outside_hours: { label: "Outside hours", tone: "amber" },
  short_notice: { label: "Short notice", tone: "amber" },
  allergy_mentioned: { label: "Allergy", tone: "tomato" },
  injection_suspected: { label: "Injection", tone: "tomato" },
  needs_clarification: { label: "Needs clarification", tone: "amber" },
  complaint: { label: "Complaint", tone: "amber" },
  counteroffer: { label: "Counteroffer", tone: "tomato" },
  off_policy: { label: "Off policy", tone: "tomato" },
  abusive: { label: "Abusive", tone: "tomato" },
  off_topic: { label: "Off topic", tone: "muted" },
};

export function flagMeta(flag: RiskFlag | string): FlagMeta {
  return LABELS[flag as RiskFlag] ?? { label: flag, tone: "muted" };
}

export const GUARD_FLAGS = new Set<string>([
  "injection_suspected",
  "off_policy",
  "abusive",
]);

export function isGuardFlag(flag: string): boolean {
  return GUARD_FLAGS.has(flag);
}
