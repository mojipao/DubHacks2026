"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { createLiveSource } from "@/lib/data/live";
import { createMockSource, getMockSnapshot } from "@/lib/data/mock";
import { emptyState, type DataSource } from "@/lib/data/source";
import type { StoreState, TraceStep } from "@/lib/data/types";
import { FIXTURE_TRACE } from "@/mocks/fixtures";

type Action =
  | { type: "hydrate"; state: Partial<StoreState> }
  | { type: "selectConversation"; id: string | null }
  | { type: "focusProposal"; id: string | null }
  | { type: "tick"; now: string };

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.state };
    case "selectConversation":
      return { ...state, selectedConversationId: action.id };
    case "focusProposal":
      return { ...state, focusedProposalId: action.id };
    case "tick":
      return { ...state, now: action.now };
    default:
      return state;
  }
}

type StoreApi = {
  state: StoreState;
  source: DataSource;
  selectConversation: (id: string | null) => void;
  focusProposal: (id: string | null) => void;
  approve: (id: string, opts?: { editedText?: string; includeLinked?: boolean }) => Promise<void>;
  reject: (id: string, opts?: { reason?: string; includeLinked?: boolean }) => Promise<void>;
  simulateInbound: (input: { handle: string; name?: string; text: string }) => Promise<void>;
  getTrace: (triggerMessageId: string | null) => TraceStep[];
  mode: "mock" | "live";
};

const StoreContext = createContext<StoreApi | null>(null);

function createSource(): { mode: "mock" | "live"; source: DataSource } {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "mock";
  if (mode === "live") {
    return { mode, source: createLiveSource() };
  }
  return { mode: "mock", source: createMockSource() };
}

function withSelection(snap: Partial<StoreState>): Partial<StoreState> {
  const proposals = snap.proposals ?? [];
  const conversations = snap.conversations ?? [];
  const pending = proposals.find((p) => p.status === "pending");
  return {
    ...snap,
    selectedConversationId:
      pending?.conversationId ?? conversations[0]?.id ?? null,
    focusedProposalId: pending?.id ?? null,
  };
}

function initialState(mode: "mock" | "live"): StoreState {
  if (mode === "mock") {
    return {
      ...emptyState("mock"),
      ...withSelection(getMockSnapshot()),
    } as StoreState;
  }
  return emptyState("polling");
}

export function DataProvider({ children }: { children: ReactNode }) {
  const boot = useMemo(() => createSource(), []);
  const [state, dispatch] = useReducer(reducer, boot.mode, initialState);

  useEffect(() => {
    let cancelled = false;
    const source = boot.source;

    // Live mode needs the async fetch; mock already has sync fixtures above.
    if (boot.mode === "live") {
      void source
        .load()
        .then((snap) => {
          if (cancelled) return;
          dispatch({ type: "hydrate", state: withSelection(snap) });
        })
        .catch((err) => {
          console.error("Failed to load control-room data", err);
        });
    }

    const unsub = source.subscribe((patch) => {
      dispatch({ type: "hydrate", state: patch });
    });

    const clock = setInterval(() => {
      dispatch({ type: "tick", now: new Date().toISOString() });
    }, 1000);

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

  const approve = useCallback(
    async (id: string, opts?: { editedText?: string; includeLinked?: boolean }) => {
      await boot.source.approve(id, opts);
    },
    [boot.source],
  );

  const reject = useCallback(
    async (id: string, opts?: { reason?: string; includeLinked?: boolean }) => {
      await boot.source.reject(id, opts);
    },
    [boot.source],
  );

  const simulateInbound = useCallback(
    async (input: { handle: string; name?: string; text: string }) => {
      await boot.source.simulateInbound(input);
    },
    [boot.source],
  );

  const getTrace = useCallback(
    (triggerMessageId: string | null): TraceStep[] => {
      if (!triggerMessageId) return [];
      if (boot.mode === "mock") {
        return FIXTURE_TRACE[triggerMessageId] ?? boot.source.getTrace(triggerMessageId);
      }
      return state.events
        .filter(
          (e) =>
            e.type === "agent.step" &&
            e.subjectType === "message" &&
            e.subjectId === triggerMessageId,
        )
        .slice()
        .reverse()
        .map((e) => {
          const data = e.data;
          return {
            id: e.id,
            at: e.at,
            agent: (data.agent as TraceStep["agent"]) ?? "intake",
            step: String(data.step ?? "step"),
            ms: Number(data.ms ?? 0),
            summary: String(data.summary ?? ""),
            reads: (data.reads as TraceStep["reads"]) ?? [],
            flags: (data.flags as string[]) ?? [],
          };
        });
    },
    [boot.mode, boot.source, state.events],
  );

  const api = useMemo<StoreApi>(
    () => ({
      state,
      source: boot.source,
      selectConversation,
      focusProposal,
      approve,
      reject,
      simulateInbound,
      getTrace,
      mode: boot.mode,
    }),
    [
      state,
      boot.source,
      boot.mode,
      selectConversation,
      focusProposal,
      approve,
      reject,
      simulateInbound,
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
