import type {
  ConnectionMode,
  FrictionStats,
  StoreState,
  UiContact,
  UiConversation,
  UiCustomer,
  UiEvent,
  UiIngredient,
  UiMessage,
  UiOrder,
  UiProposal,
} from "@/lib/data/types";

export type DataSnapshot = {
  customers: UiCustomer[];
  conversations: UiConversation[];
  messages: UiMessage[];
  proposals: UiProposal[];
  orders: UiOrder[];
  ingredients: UiIngredient[];
  events: UiEvent[];
  friction: FrictionStats;
  connection: ConnectionMode;
};

export type DataSource = {
  mode: ConnectionMode;
  load(): Promise<DataSnapshot>;
  subscribe(onChange: (patch: Partial<DataSnapshot>) => void): () => void;
  /** `alternativeIndex` sends one of the agents' alternative wordings instead of the main draft. */
  approve(id: string, opts?: { editedText?: string; alternativeIndex?: number; includeLinked?: boolean }): Promise<void>;
  /** The owner's own message; it supersedes any pending agent reply in that thread. */
  sendMessage(conversationId: string, text: string, clientId: string): Promise<void>;
  reject(id: string, opts?: { reason?: string; includeLinked?: boolean }): Promise<void>;
  simulateInbound(input: { handle: string; name?: string; text: string }): Promise<void>;
  retry(id: string): Promise<void>;
  markPaid(orderId: string): Promise<void>;
  /** "Customer pays (sandbox)": a real Square sandbox payment in live mode. */
  customerPays(orderId: string): Promise<{ amountCents?: number }>;
  listContacts(): Promise<UiContact[]>;
  /** Older messages in one thread, oldest first, before `before` (a createdAt). */
  loadHistory(conversationId: string, before?: string): Promise<{ messages: UiMessage[]; hasMore: boolean }>;
  winbackScan(): Promise<number>;
  receiveDelivery(): Promise<void>;
};

export function emptyState(connection: ConnectionMode): StoreState {
  return {
    customers: [],
    conversations: [],
    messages: [],
    proposals: [],
    orders: [],
    ingredients: [],
    events: [],
    friction: {
      messagesHandled: 0,
      ordersCreated: 0,
      reordersDrafted: 0,
      guardCatches: 0,
      ownerMinutesSaved: 0,
    },
    connection,
    selectedConversationId: null,
    focusedProposalId: null,
    now: new Date().toISOString(),
  };
}
