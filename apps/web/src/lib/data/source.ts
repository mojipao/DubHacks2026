import type {
  ConnectionMode,
  FrictionStats,
  StoreState,
  TraceStep,
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
  getTrace(triggerMessageId: string): TraceStep[];
  approve(id: string, opts?: { editedText?: string; includeLinked?: boolean }): Promise<void>;
  reject(id: string, opts?: { reason?: string; includeLinked?: boolean }): Promise<void>;
  simulateInbound(input: { handle: string; name?: string; text: string }): Promise<void>;
  retry(id: string): Promise<void>;
  markPaid(orderId: string): Promise<void>;
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
