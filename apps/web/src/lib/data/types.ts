import type {
  Evidence,
  ProposalStatus,
  RecordRef,
  ReplyPayload,
  ReorderPayload,
  RiskFlag,
} from "@boh/shared";

export type AgentLabel = "intake" | "ops" | "winback" | "guard";

export type UiCustomer = {
  id: string;
  name: string;
  handle: string | null;
  isDemoPersona: boolean;
};

export type UiConversation = {
  id: string;
  customerId: string | null;
  handle: string;
  customerName: string | null;
  platform: "imessage" | "simulated";
  role: "customer" | "owner";
  lastMessageAt: string;
  lastPreview: string;
  hasPendingTicket: boolean;
};

export type UiMessage = {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  body: string;
  status: string;
  createdAt: string;
  approvedByOwner?: boolean;
};

export type UiProposal = {
  id: string;
  agent: "intake" | "ops" | "winback";
  kind: "reply" | "reorder";
  status: ProposalStatus;
  conversationId: string | null;
  triggerMessageId: string | null;
  parentProposalId: string | null;
  title: string;
  summary: string;
  rationale: string;
  payload: ReplyPayload | ReorderPayload;
  evidence: Evidence[];
  reads: RecordRef[];
  confidence: number;
  riskFlags: RiskFlag[];
  shortCode: string | null;
  createdAt: string;
  decidedAt: string | null;
  executedAt: string | null;
  error: string | null;
  approvedVia?: "ui" | "imessage";
  customerName: string | null;
  guardSummary?: string;
};

export type UiOrder = {
  id: string;
  customerId: string | null;
  customerName: string | null;
  status: "awaiting_payment" | "paid" | "fulfilled" | "cancelled";
  pickupAt: string;
  totalCents: number;
  discountCents: number;
  source: "history" | "agent";
  createdAt: string;
  paidAt: string | null;
  items: { productId: string; name: string; qty: number }[];
  hasShortfall?: boolean;
};

export type UiIngredient = {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  onOrder: number;
  reorderPoint: number;
};

export type UiEvent = {
  id: string;
  at: string;
  actor: string;
  type: string;
  subjectType: string | null;
  subjectId: string | null;
  data: Record<string, unknown>;
};

export type TraceStep = {
  id: string;
  at: string;
  agent: AgentLabel;
  step: string;
  ms: number;
  summary: string;
  reads: RecordRef[];
  flags: string[];
};

export type FrictionStats = {
  messagesHandled: number;
  ordersCreated: number;
  reordersDrafted: number;
  guardCatches: number;
  ownerMinutesSaved: number;
};

export type ConnectionMode = "mock" | "realtime" | "polling";

export type StoreState = {
  customers: UiCustomer[];
  conversations: UiConversation[];
  messages: UiMessage[];
  proposals: UiProposal[];
  orders: UiOrder[];
  ingredients: UiIngredient[];
  events: UiEvent[];
  friction: FrictionStats;
  connection: ConnectionMode;
  selectedConversationId: string | null;
  focusedProposalId: string | null;
  now: string;
};
