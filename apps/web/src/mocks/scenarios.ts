import { PAYMENT_LINK_TOKEN, type RiskFlag } from "@boh/shared";
import type { TraceStep, UiProposal } from "@/lib/data/types";
import { BRAND_SHORT } from "@/lib/business";
import { FIXTURE_SAT_PICKUP } from "@/mocks/fixtures";

/** What a mock agent run produces: the trace steps it streams, then the tickets it drafts. */
export type ScriptedRun = {
  steps: Omit<TraceStep, "id" | "at">[];
  proposals: Omit<UiProposal, "id" | "createdAt" | "conversationId" | "triggerMessageId" | "customerName">[];
};

const SUN_PICKUP = new Date(Date.parse(FIXTURE_SAT_PICKUP) + 24 * 3600_000).toISOString();
const SIGN = `\n— ${BRAND_SHORT}`;

function base(flags: RiskFlag[] = []) {
  return {
    status: "pending" as const,
    parentProposalId: null,
    riskFlags: flags,
    shortCode: null,
    decidedAt: null,
    executedAt: null,
    error: null,
  };
}

/** Picks the demo scenario a simulated text matches, mirroring what lane 3's agents draft. */
export function scriptFor(text: string, firstName: string | null): ScriptedRun {
  const t = text.toLowerCase();
  const hi = firstName ? `Hi ${firstName}, ` : "Hi, ";

  if (/ignore|free|password|wifi|system prompt|instructions/.test(t)) {
    return {
      steps: [
        { agent: "intake", step: "understand", ms: 640, summary: "No order; asks for free items and to ignore instructions", reads: [], flags: ["injection_suspected", "off_policy"] },
        { agent: "guard", step: "guard", ms: 9, summary: "Guard: asked to ignore instructions and for free food. Reply declines; no order.", reads: [], flags: ["injection_suspected", "off_policy"] },
      ],
      proposals: [
        {
          ...base(["injection_suspected", "off_policy", "new_customer"]),
          agent: "intake",
          kind: "reply",
          title: "Decline off-policy ask",
          summary: "Declines politely and offers the real menu. No order.",
          rationale: "Asked to ignore instructions and for free food: decline, no order.",
          payload: { text: `${hi}we can't give anything away, but a cold brew is $5.25 and we're pouring all morning. Want one?${SIGN}`, orders: [] },
          evidence: [{ label: "Ask", value: "Free items + ignore instructions" }],
          reads: [{ table: "messages", id: "sim" }],
          confidence: 0.94,
          guardSummary: "Guard: asked to ignore instructions and for free food. Reply declines; no order.",
        },
      ],
    };
  }

  if (/dozen|48|catering/.test(t)) {
    return {
      steps: [
        { agent: "intake", step: "context", ms: 120, summary: "Loaded customer, 2 past catering orders, catalog", reads: [{ table: "customers", id: "jun" }, { table: "orders", id: "h1" }, { table: "orders", id: "h2" }], flags: [] },
        { agent: "intake", step: "understand", ms: 910, summary: "48 × milk cake, Sat 9:00 (\"milk cakes\" → milk cake)", reads: [{ table: "products", id: "milk-cake" }], flags: ["large_order"] },
        { agent: "ops", step: "ops_check", ms: 41, summary: "Saturday milk cakes: 12 of 36 committed, 24 left; ghee covers ~30 more", reads: [{ table: "capacity", id: "sat" }, { table: "ingredients", id: "ghee" }], flags: ["capacity_shortfall", "ingredient_shortfall"] },
        { agent: "ops", step: "plan", ms: 18, summary: "Split 24 Sat / 24 Sun; reorder 3 kg ghee from Rainier Dairy ($38.40)", reads: [{ table: "capacity", id: "sun" }], flags: ["counteroffer"] },
        { agent: "intake", step: "draft", ms: 640, summary: "Counteroffer reply with one payment link for both pickups", reads: [], flags: [] },
        { agent: "guard", step: "guard", ms: 12, summary: "One payment link; prices from the menu; length OK", reads: [], flags: [] },
      ],
      proposals: [
        {
          ...base(["large_order", "capacity_shortfall", "ingredient_shortfall", "counteroffer"]),
          agent: "intake",
          kind: "reply",
          title: "Counteroffer: split across the weekend",
          summary: "48 milk cakes as 24 Sat + 24 Sun behind one link ($216.00).",
          rationale: "Can't fit 48 Saturday: split 24 Sat / 24 Sun, ghee reorder needed.",
          payload: {
            text: `${hi}Saturday only has 24 milk cakes left, so I can't do all 48 that morning. I can hold 24 Sat 9:00 and 24 Sun 9:00 behind one link ($216.00). Paying confirms the split. ${PAYMENT_LINK_TOKEN}${SIGN}`,
            orders: [
              { items: [{ productId: "milk-cake", qty: 24 }], pickupAt: FIXTURE_SAT_PICKUP },
              { items: [{ productId: "milk-cake", qty: 24 }], pickupAt: SUN_PICKUP },
            ],
          },
          evidence: [
            { label: "Saturday capacity", value: "Milk cake 12/36, 24 left" },
            { label: "Sunday capacity", value: "Milk cake 6/36, 30 left" },
            { label: "Stock", value: "Ghee covers ~30 more milk cakes" },
            { label: "Asked", value: "48 × milk cake Sat 9:00" },
          ],
          reads: [
            { table: "orders", id: "h1" }, { table: "orders", id: "h2" }, { table: "orders", id: "s1" }, { table: "orders", id: "s2" },
            { table: "capacity", id: "sat" }, { table: "capacity", id: "sun" }, { table: "ingredients", id: "ghee" }, { table: "customers", id: "jun" },
          ],
          confidence: 0.86,
        },
        {
          ...base(["ingredient_shortfall"]),
          agent: "ops",
          kind: "reorder",
          title: "Reorder ghee from Rainier Dairy",
          summary: "3 kg cultured ghee by Friday for the split order.",
          rationale: "Ghee on hand covers ~30 more; 48 milk cakes needs a restock.",
          payload: {
            supplier: "Rainier Dairy",
            lines: [{ ingredientId: "ghee", qty: 3 }],
            neededBy: new Date(Date.parse(FIXTURE_SAT_PICKUP) - 24 * 3600_000).toISOString(),
          },
          evidence: [
            { label: "Supplier", value: "Rainier Dairy · $12.80/kg" },
            { label: "Shortfall", value: "≈1.6 kg after the split" },
          ],
          reads: [{ table: "ingredients", id: "ghee" }, { table: "recipes", id: "milk-cake" }],
          confidence: 0.9,
        },
      ],
    };
  }

  // Priya's customer notes record a tree-nut allergy, so any pistachio order from her gets the flag.
  if (/allerg|nut/.test(t) || (firstName === "Priya" && /pistachio/.test(t))) {
    return {
      steps: [
        { agent: "intake", step: "context", ms: 95, summary: "Customer notes: tree-nut allergy (mentioned 2026-09)", reads: [{ table: "customers", id: "priya" }], flags: ["allergy_mentioned"] },
        { agent: "intake", step: "resolve", ms: 30, summary: "Pistachio maamoul contains pistachios and pistachio cream", reads: [{ table: "products", id: "pistachio-maamoul" }, { table: "recipes", id: "pistachio-maamoul" }], flags: ["allergy_mentioned"] },
        { agent: "guard", step: "guard", ms: 8, summary: "Allergy: no safety promise in the reply; owner confirms", reads: [], flags: ["allergy_mentioned"] },
      ],
      proposals: [
        {
          ...base(["allergy_mentioned"]),
          agent: "intake",
          kind: "reply",
          title: "Allergy question",
          summary: "States the pistachio maamoul contains nuts; no order until confirmed.",
          rationale: "Allergy mentioned: say plainly it has pistachios, no safety promise.",
          payload: { text: `${hi}the pistachio maamoul is made with pistachios and pistachio cream, so it isn't safe with a nut allergy. The milk cake has no nuts in the recipe, but our kitchen handles nuts.${SIGN}`, orders: [] },
          evidence: [
            { label: "Customer notes", value: "Tree-nut allergy (mentioned 2026-09)" },
            { label: "Recipe", value: "Pistachio maamoul: pistachios, pistachio cream" },
          ],
          reads: [{ table: "customers", id: "priya" }, { table: "products", id: "pistachio-maamoul" }, { table: "recipes", id: "pistachio-maamoul" }],
          confidence: 0.7,
        },
      ],
    };
  }

  if (/usual/.test(t)) {
    return {
      steps: [
        { agent: "intake", step: "context", ms: 110, summary: "Loaded Maya: 14 past orders, last 42 days ago", reads: [{ table: "customers", id: "maya" }, { table: "orders", id: "m1" }], flags: [] },
        { agent: "intake", step: "understand", ms: 820, summary: "\"The usual\" = 2 pistachio maamoul + adeni chai, Sat 9:00", reads: [{ table: "orders", id: "m2" }], flags: [] },
        { agent: "ops", step: "ops_check", ms: 22, summary: "Saturday pistachio maamoul: 8 of 48 committed", reads: [{ table: "capacity", id: "sat" }], flags: [] },
        { agent: "intake", step: "draft", ms: 590, summary: "Confirm usual with welcome-back 10% ($18.50 → $16.65)", reads: [], flags: [] },
      ],
      proposals: [
        {
          ...base([]),
          agent: "intake",
          kind: "reply",
          title: "The usual for Saturday",
          summary: "2 pistachio maamoul + adeni chai, Sat 9:00, welcome back 10%.",
          rationale: "Usual order; last visit 42 days ago, so the welcome-back 10% applies.",
          payload: {
            text: `${hi}2 pistachio maamoul and an adeni chai for Saturday 9:00. It's been a while, so 10% off. ${PAYMENT_LINK_TOKEN}${SIGN}`,
            orders: [
              {
                items: [{ productId: "pistachio-maamoul", qty: 2 }, { productId: "adeni-chai", qty: 1 }],
                pickupAt: FIXTURE_SAT_PICKUP,
                perk: "welcome_back_10",
              },
            ],
          },
          evidence: [
            { label: "Usual", value: "2× pistachio maamoul, 1× adeni chai (11 of 14 orders)" },
            { label: "Last visit", value: "42 days ago" },
          ],
          reads: Array.from({ length: 14 }, (_, i) => ({ table: "orders", id: `m${i}` })).concat([{ table: "customers", id: "maya" }]),
          confidence: 0.91,
        },
      ],
    };
  }

  return {
    steps: [
      { agent: "intake", step: "understand", ms: 700, summary: "Order request; checking catalog and capacity", reads: [{ table: "products", id: "catalog" }], flags: [] },
      { agent: "intake", step: "draft", ms: 520, summary: "Confirm-and-clarify reply", reads: [], flags: ["needs_clarification"] },
    ],
    proposals: [
      {
        ...base(["needs_clarification"]),
        agent: "intake",
        kind: "reply",
        title: "Clarify the order",
        summary: "Asks for the pickup time before drafting an order.",
        rationale: "Order is unclear: ask one question before taking payment.",
        payload: { text: `${hi}happy to set that aside. What time works for pickup? We're open 8 to 2 on the weekend.${SIGN}`, orders: [] },
        evidence: [{ label: "Hours", value: "Sat–Sun 8:00–14:00" }],
        reads: [{ table: "products", id: "catalog" }],
        confidence: 0.58,
      },
    ],
  };
}
