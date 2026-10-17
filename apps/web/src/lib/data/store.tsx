"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { createLiveSource } from "@/lib/data/live";
import { createMockSource, getMockSnapshot } from "@/lib/data/mock";
import { emptyState, type DataSource } from "@/lib/data/source";
import type { StoreState, TraceStep, UiEvent, UiProposal } from "@/lib/data/types";

type Action =
  | { type: "hydrate"; state: Partial<StoreState> }
  | { type: "patchProposals"; ids: string[]; patch: Partial<UiProposal> }
  | { type: "selectConversation"; id: string | null }
  | { type: "focusProposal"; id: string | null }
  | { type: "loadError"; message: string | null }
  | { type: "tick"; now: string };

type State = StoreState & { loadError: string | null; loaded: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate": {
      const next = { ...state, ...action.state, loaded: true, loadError: null };
      // An empty board that just got its first conversation should open it.
      if (!next.selectedConversationId && next.conversations.length > 0) {
        next.selectedConversationId = next.conversations[0].id;
      }
      return next;
    }
    case "patchProposals":
      return {
        ...state,
        proposals: state.proposals.map((p) =>
          action.ids.includes(p.id) ? { ...p, ...action.patch } : p,
        ),
      };
    case "selectConversation":
      return { ...state, selectedConversationId: action.id };
    case "focusProposal":
      return { ...state, focusedProposalId: action.id };
    case "loadError":
      return { ...state, loadError: action.message };
    case "tick":
      return { ...state, now: action.now };
    default:
      return state;
  }
}

type DecisionOpts = { includeLinked?: boolean };

type StoreApi = {
  state: State;
  source: DataSource;
  mode: "mock" | "live";
  selectConversation: (id: string | null) => void;
  focusProposal: (id: string | null) => void;
  approve: (id: string, opts?: DecisionOpts & { editedText?: string }) => Promise<void>;
  reject: (id: string, opts?: DecisionOpts & { reason?: string }) => Promise<void>;
  retry: (id: string) => Promise<void>;
  simulateInbound: (input: { handle: string; name?: string; text: string }) => Promise<void>;
  markPaid: (orderId: string) => Promise<void>;
  winbackScan: () => Promise<number>;
  receiveDelivery: () => Promise<void>;
  getTrace: (proposal: Pick<UiProposal, "triggerMessageId" | "agent" | "createdAt">) => TraceStep[];
};

const StoreContext = createContext<StoreApi | null>(null);

function createSource(): { mode: "mock" | "live"; source: DataSource } {
  if (process.env.NEXT_PUBLIC_DATA_MODE === "live") {
    return { mode: "live", source: createLiveSource() };
  }
  return { mode: "mock", source: createMockSource() };
}

function withSelection(snap: Partial<StoreState>): Partial<StoreState> {
  const pending = (snap.proposals ?? []).find((p) => p.status === "pending");
  return {
    ...snap,
    selectedConversationId: pending?.conversationId ?? snap.conversations?.[0]?.id ?? null,
    focusedProposalId: pending?.id ?? null,
  };
}

function initialState(mode: "mock" | "live"): State {
  if (mode === "mock") {
    return {
      ...emptyState("mock"),
      ...withSelection(getMockSnapshot()),
      loadError: null,
      loaded: true,
    } as State;
  }
  return { ...emptyState("polling"), loadError: null, loaded: false };
}

/** The ids an approve or reject touches: the ticket, plus its pending children when linked. */
function affectedIds(proposals: UiProposal[], id: string, includeLinked?: boolean): string[] {
  if (!includeLinked) return [id];
  return [
    id,
    ...proposals.filter((p) => p.parentProposalId === id && p.status === "pending").map((p) => p.id),
  ];
}

/** The agent.step events behind a ticket, oldest first. */
export function traceFor(events: UiEvent[], proposal: Pick<UiProposal, "triggerMessageId" | "agent" | "createdAt">): TraceStep[] {
  const created = Date.parse(proposal.createdAt);
  return events
    .filter((e) => {
      if (e.type !== "agent.step") return false;
      if (proposal.triggerMessageId) return e.subjectId === proposal.triggerMessageId;
      // Win-back scans have no trigger message: take that scan's steps, written just before the ticket.
      const at = Date.parse(e.at);
      return e.data.agent === proposal.agent && at <= created + 2000 && at >= created - 60_000;
    })
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || Number(a.id) - Number(b.id))
    .map((e) => ({
      id: e.id,
      at: e.at,
      agent: (e.data.agent as TraceStep["agent"]) ?? "intake",
      step: String(e.data.step ?? "step"),
      ms: Number(e.data.ms ?? 0),
      summary: String(e.data.summary ?? e.data.error ?? ""),
      reads: (e.data.reads as TraceStep["reads"]) ?? [],
      flags: (e.data.flags as string[]) ?? [],
    }));
}

function statusOf(err: unknown): number | undefined {
  return typeof err === "object" && err && "status" in err
    ? Number((err as { status: unknown }).status)
    : undefined;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const boot = useMemo(() => createSource(), []);
  const [state, dispatch] = useReducer(reducer, boot.mode, initialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    let cancelled = false;
    const source = boot.source;

    // Mock mode already painted from sync fixtures; live mode fetches first.
    if (boot.mode === "live") {
      void source
        .load()
        .then((snap) => {
          if (!cancelled) dispatch({ type: "hydrate", state: withSelection(snap) });
        })
        .catch((err: unknown) => {
          console.error("Failed to load control-room data", err);
          if (!cancelled) {
            dispatch({
              type: "loadError",
              message: err instanceof Error ? err.message : "Failed to load live data",
            });
          }
        });
    }

    const unsub = source.subscribe((patch) => dispatch({ type: "hydrate", state: patch }));
    const clock = setInterval(() => dispatch({ type: "tick", now: new Date().toISOString() }), 1000);

    return () => {
      cancelled = true;
      unsub();
      clearInterval(clock);
    };
  }, [boot.mode, boot.source]);

  const selectConversation = useCallback((id: string | null) => {
    dispatch({ type: "selectConversation", id });
  }, []);

  const focusProposal = useCallback((id: string | null) => {
    dispatch({ type: "focusProposal", id });
  }, []);

  const approve = useCallback<StoreApi["approve"]>(
    async (id, opts) => {
      const ids = affectedIds(stateRef.current.proposals, id, opts?.includeLinked);
      const before = stateRef.current.proposals.filter((p) => ids.includes(p.id));
      dispatch({ type: "patchProposals", ids, patch: { status: "executing", error: null } });
      try {
        await boot.source.approve(id, opts);
      } catch (err) {
        const status = statusOf(err);
        if (status === 409) {
          // Someone (or the owner's phone) got there first; the realtime update will show what happened.
          throw Object.assign(new Error("Already handled"), { status });
        }
        if (status !== 502) {
          // The server never ran it, so put the tickets back the way they were.
          for (const p of before) {
            dispatch({ type: "patchProposals", ids: [p.id], patch: { status: p.status, error: p.error } });
          }
        } else {
          dispatch({
            type: "patchProposals",
            ids: [id],
            patch: { status: "failed", error: err instanceof Error ? err.message : "Execution failed" },
          });
        }
        throw err;
      }
    },
    [boot.source],
  );

  const reject = useCallback<StoreApi["reject"]>(
    async (id, opts) => {
      try {
        await boot.source.reject(id, opts);
      } catch (err) {
        if (statusOf(err) === 409) throw Object.assign(new Error("Already handled"), { status: 409 });
        throw err;
      }
    },
    [boot.source],
  );

  const retry = useCallback<StoreApi["retry"]>(
    async (id) => {
      dispatch({ type: "patchProposals", ids: [id], patch: { status: "executing", error: null } });
      try {
        await boot.source.retry(id);
      } catch (err) {
        dispatch({
          type: "patchProposals",
          ids: [id],
          patch: { status: "failed", error: err instanceof Error ? err.message : "Retry failed" },
        });
        throw err;
      }
    },
    [boot.source],
  );

  const simulateInbound = useCallback<StoreApi["simulateInbound"]>(
    (input) => boot.source.simulateInbound(input),
    [boot.source],
  );
  const markPaid = useCallback<StoreApi["markPaid"]>(
    (orderId) => boot.source.markPaid(orderId),
    [boot.source],
  );
  const winbackScan = useCallback(() => boot.source.winbackScan(), [boot.source]);
  const receiveDelivery = useCallback(() => boot.source.receiveDelivery(), [boot.source]);

  const getTrace = useCallback<StoreApi["getTrace"]>(
    (proposal) => traceFor(state.events, proposal),
    [state.events],
  );

  const api = useMemo<StoreApi>(
    () => ({
      state,
      source: boot.source,
      mode: boot.mode,
      selectConversation,
      focusProposal,
      approve,
      reject,
      retry,
      simulateInbound,
      markPaid,
      winbackScan,
      receiveDelivery,
      getTrace,
    }),
    [
      state,
      boot.source,
      boot.mode,
      selectConversation,
      focusProposal,
      approve,
      reject,
      retry,
      simulateInbound,
      markPaid,
      winbackScan,
      receiveDelivery,
      getTrace,
    ],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within DataProvider");
  return ctx;
}
