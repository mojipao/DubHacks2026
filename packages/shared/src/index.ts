import { z } from "zod";

export const ProductId = z.string().min(1);
export const IsoDateTime = z.iso.datetime({ offset: true });

export const AgentName = z.enum(["intake", "ops", "winback"]);
export const ProposalKind = z.enum(["reply", "reorder"]);
export const ProposalStatus = z.enum([
  "pending", "executing", "executed", "rejected", "superseded", "failed",
]);

export const RiskFlag = z.enum([
  "new_customer",
  "low_confidence",
  "large_order",
  "capacity_shortfall",
  "ingredient_shortfall",
  "outside_hours",
  "short_notice",
  "allergy_mentioned",
  "injection_suspected",
  "needs_clarification",
  "complaint",
  "counteroffer",        // the agent could not do what was asked and proposes an alternative
  "off_policy",          // asked for free items, unlisted discounts, other customers' data, etc.
  "abusive",
  "off_topic",
]);

export const RecordRef = z.object({ table: z.string(), id: z.string() });

export const Evidence = z.object({
  label: z.string(),
  value: z.string(),
  source: RecordRef.optional(),
});

export const OrderLine = z.object({ productId: ProductId, qty: z.number().int().positive() });

export const OrderDraft = z.object({
  items: z.array(OrderLine).min(1),
  pickupAt: IsoDateTime,
  perk: z.enum(["welcome_back_10"]).optional(),
});

/** Zero orders: a plain reply. One: a normal order. Two: a split counteroffer (e.g. 24 Saturday + 24 Sunday) behind one payment link. */
export const ReplyPayload = z.object({
  text: z.string().min(1).max(1200),
  orders: z.array(OrderDraft).max(2).default([]),
});

export const ReorderPayload = z.object({
  supplier: z.string(),
  lines: z.array(z.object({ ingredientId: z.string(), qty: z.number().positive() })).min(1),
  neededBy: IsoDateTime.optional(),
});

const DraftBase = z.object({
  agent: AgentName,
  title: z.string().max(80),
  summary: z.string().max(280),
  /** One line: why the agent proposes this, in plain words. Shown on the ticket face. */
  rationale: z.string().max(160),
  evidence: z.array(Evidence),
  /** Every record the agent read to build this draft. The ticket shows counts by table. */
  reads: z.array(RecordRef),
  confidence: z.number().min(0).max(1),
  riskFlags: z.array(RiskFlag),
  /** Index of another draft in the same returned array that this one depends on. */
  parentIndex: z.number().int().nonnegative().optional(),
});

export const ProposalDraft = z.discriminatedUnion("kind", [
  DraftBase.extend({ kind: z.literal("reply"), payload: ReplyPayload }),
  DraftBase.extend({ kind: z.literal("reorder"), payload: ReorderPayload }),
]);

export type RecordRef = z.infer<typeof RecordRef>;
export type Evidence = z.infer<typeof Evidence>;
export type RiskFlag = z.infer<typeof RiskFlag>;
export type OrderLine = z.infer<typeof OrderLine>;
export type OrderDraft = z.infer<typeof OrderDraft>;
export type ReplyPayload = z.infer<typeof ReplyPayload>;
export type ReorderPayload = z.infer<typeof ReorderPayload>;
export type ProposalDraft = z.infer<typeof ProposalDraft>;
export type ProposalStatus = z.infer<typeof ProposalStatus>;

/** The placeholder the server replaces with the Square payment link URL at execution time. */
export const PAYMENT_LINK_TOKEN = "{{payment_link}}";

export interface BusinessProfile {
  name: string;
  timezone: string;                 // "America/Los_Angeles"
  hours: Record<"mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun", { open: string; close: string } | null>;
  minLeadHours: number;             // ordinary pre-orders
  cateringThresholdUnits: number;   // at or above this many units, treat as catering
  cateringLeadHours: number;
  largeOrderCents: number;          // flag above this total
  welcomeBackAfterDays: number;     // perk eligibility
  winbackOverdueFactor: number;     // flag a regular when days since last order > factor × their median interval
  winbackMinOrders: number;         // only customers with at least this many orders count as regulars
  minutesSaved: { reply: number; order: number; counteroffer: number; reorder: number; guardCatch: number };
  voice: string;                    // one paragraph describing how the shop texts
  poweredByFooter: string;          // appended by the server to every customer reply
}

export interface RegularCadence {
  customerId: string;
  name: string;
  orderCount: number;
  medianIntervalDays: number;
  daysSinceLast: number;
  hasOpenConversation: boolean;     // a Photon space exists, so the line can message them
}

export interface CustomerProfile {
  id: string;
  name: string;
  handle: string | null;
  notes: string | null;
  isDemoPersona: boolean;
}

export interface OrderSummary {
  id: string;
  createdAt: string;
  pickupAt: string;
  status: "awaiting_payment" | "paid" | "fulfilled" | "cancelled";
  totalCents: number;
  items: { productId: string; name: string; qty: number }[];
}

export interface Product {
  id: string;
  name: string;
  category: "pastry" | "bread" | "drink" | "cake" | "savory";
  priceCents: number;
  dailyCapacity: number;
  aliases: string[];   // "croissants" → butter croissant
  active: boolean;
}

export interface DayLoad {
  productId: string;
  committed: number;   // units in awaiting_payment + paid orders for that local date
  capacity: number;
}

export interface IngredientNeed {
  ingredientId: string;
  name: string;
  unit: string;
  need: number;        // for the requested items plus everything already committed that day
  onHand: number;
  onOrder: number;
  shortfall: number;   // max(0, need - onHand - onOrder)
  supplier: string;
}

export interface ConversationContext {
  id: string;
  handle: string;
  customerId: string | null;
  messages: { id: string; direction: "inbound" | "outbound"; body: string; createdAt: string }[];
}

/** Read-only access the server gives to agents. Lane 2 implements it on Supabase; lane 3 implements it on fixtures. */
export interface AgentDataPort {
  getConversation(conversationId: string, limit?: number): Promise<ConversationContext>;
  getCustomer(customerId: string): Promise<CustomerProfile | null>;
  getCustomerByHandle(handle: string): Promise<CustomerProfile | null>;
  getOrderHistory(customerId: string, limit?: number): Promise<OrderSummary[]>;
  getCatalog(): Promise<Product[]>;
  getDayLoad(localDate: string): Promise<DayLoad[]>;   // "YYYY-MM-DD" in business timezone
  getIngredientNeeds(items: OrderLine[], localDate: string): Promise<IngredientNeed[]>;
  getPendingProposals(conversationId: string): Promise<{ id: string; kind: "reply" | "reorder"; summary: string }[]>;
  /** Next open days after localDate with remaining capacity per product, for counteroffers. */
  getNextOpenDays(localDate: string, count: number): Promise<{ localDate: string; load: DayLoad[] }[]>;
  getRegularCadences(): Promise<RegularCadence[]>;
}

export interface AgentContext {
  data: AgentDataPort;
  business: BusinessProfile;
  now: () => Date;
  /** The server writes each call as an `agent.step` event, which the UI shows as the ticket's trace. */
  trace: (step: string, detail: Record<string, unknown>) => void;
}

export interface InboundInput { conversationId: string; messageId: string }

/** Implemented by packages/agents. */
export type HandleInbound = (input: InboundInput, ctx: AgentContext) => Promise<ProposalDraft[]>;
/** Proactive: proposes win-back replies for overdue regulars. Optional export. */
export type RunWinbackScan = (ctx: AgentContext) => Promise<ProposalDraft[]>;
