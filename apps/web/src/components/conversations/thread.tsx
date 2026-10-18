"use client";

import { useMemo, useRef, useState } from "react";
import { Phone, SendHorizontal } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { GlowButton } from "@/components/glow-button";
import { useStore } from "@/lib/data/store";
import type { UiMessage } from "@/lib/data/types";
import { toast } from "sonner";
import { maskHandle, relativeTime } from "@/lib/format";
import { sendOwnerMessage } from "@/lib/actions";
import { callsByConversation, formatDuration, senders, type Sender } from "@/lib/data/derive";
import { cn } from "@/lib/utils";

export function ConversationThread({
  standalone = false,
  onOpenTicket,
}: {
  /** Fills its own panel (the Conversations tab) instead of sitting under the list. */
  standalone?: boolean;
  onOpenTicket?: (conversationId: string) => void;
} = {}) {
  const { state, loadHistory, mode } = useStore();
  const calls = useMemo(() => callsByConversation(state.events), [state.events]);
  const sentBy = useMemo(() => senders(state.events), [state.events]);
  const reduce = useReducedMotion();
  // Older messages paged in from lane 2's history route, per conversation; the store only holds recent ones.
  const [earlier, setEarlier] = useState<Record<string, { messages: UiMessage[]; hasMore: boolean }>>({});
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const conv = state.conversations.find(
    (c) => c.id === state.selectedConversationId,
  );
  const paged = state.selectedConversationId ? earlier[state.selectedConversationId] : undefined;
  const messages = useMemo(() => {
    const byId = new Map<string, UiMessage>();
    for (const m of paged?.messages ?? []) byId.set(m.id, m);
    for (const m of state.messages) if (m.conversationId === state.selectedConversationId) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }, [state.messages, state.selectedConversationId, paged]);

  const showLoadEarlier = paged ? paged.hasMore : messages.length > 0;
  const loadEarlier = async () => {
    const id = state.selectedConversationId;
    if (!id || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const res = await loadHistory(id, messages[0]?.createdAt);
      setEarlier((prev) => ({
        ...prev,
        [id]: { messages: [...res.messages, ...(prev[id]?.messages ?? [])], hasMore: res.hasMore },
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load earlier messages");
    } finally {
      setLoadingEarlier(false);
    }
  };

  if (!conv) {
    return (
      <div className={cn("flex h-40 flex-1 items-center justify-center px-4 text-[13px] text-muted", !standalone && "border-t border-line")}>
        Select a conversation
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", !standalone && "border-t border-line")}>
      <div className={cn("flex items-center justify-between gap-3 px-4 pt-3 pb-2", standalone && "border-b border-line px-6 pt-4 pb-3")}>
        <div className="min-w-0">
          <div className={cn("truncate font-medium text-fg", standalone ? "heading text-[24px] leading-tight font-normal" : "text-[14px]")}>
            {conv.role === "owner" ? "Owner" : (conv.customerName ?? maskHandle(conv.handle))}
          </div>
          <div className="font-mono text-[11px] text-muted">
            {maskHandle(conv.handle)} · {calls.has(conv.id) ? "phone call" : conv.platform}
          </div>
        </div>
        {onOpenTicket && conv.hasPendingTicket && (
          <GlowButton tone="cherry" size="sm" className="shrink-0" onClick={() => onOpenTicket(conv.id)}>
            Ticket waiting · open in the pass
          </GlowButton>
        )}
      </div>
      <div className={cn("min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-3", standalone && "mx-auto w-full max-w-3xl px-6 py-5")}>
        {showLoadEarlier && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={() => void loadEarlier()}
              disabled={loadingEarlier}
              className="rounded-full border border-line-strong px-3.5 py-1 text-[12px] font-semibold tracking-wide text-muted uppercase hover:text-fg disabled:opacity-50"
            >
              {loadingEarlier ? "Loading…" : "Load earlier"}
            </button>
          </div>
        )}
        {(calls.get(conv.id) ?? []).map((call) => (
          <div key={call.callId} className="rounded-2xl border border-line-strong bg-surface-2/60 px-3.5 py-3 text-[13px]">
            <div className="flex items-center gap-2 font-medium text-fg">
              <Phone className="size-3.5 text-sky" aria-hidden />
              Phone call · {formatDuration(call.durationSecs)} · {call.turns} turns
              <span className="ml-auto font-mono text-[10px] text-muted">{relativeTime(call.startedAt)}</span>
            </div>
            {call.summary && <p className="mt-1.5 leading-snug text-muted">{call.summary}</p>}
            <p className="mt-1 font-mono text-[10px] text-muted">Transcript below, caller on the left, agent on the right.</p>
          </div>
        ))}
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "max-w-[90%] rounded-2xl px-3 py-2 text-[13.5px] leading-snug",
              m.direction === "inbound"
                ? "rounded-bl-md bg-surface-2 text-fg"
                : "ml-auto rounded-br-md bg-ticket text-ink",
            )}
          >
            <p className="whitespace-pre-wrap">{m.body}</p>
            <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-muted">
              <span>{relativeTime(m.createdAt)}</span>
              {m.direction === "outbound" && <SenderLabel sender={sentBy.get(m.id)} />}
            </div>
          </motion.div>
        ))}
      </div>
      {conv.role === "customer" && <Composer conversationId={conv.id} live={mode !== "mock"} />}
    </div>
  );
}

const SENDER_LABEL: Record<Sender, string> = {
  agent: "agent · on its own",
  "agent-checkin": "agent · order check-in",
  owner: "you",
  "owner-approved": "approved by you",
};

function SenderLabel({ sender }: { sender?: Sender }) {
  if (!sender) return null;
  return <span className={cn(sender.startsWith("agent") && "text-amber")}>{SENDER_LABEL[sender]}</span>;
}

/** The owner's own message. It sends now, and closes any agent draft waiting in this thread. */
function Composer({ conversationId, live }: { conversationId: string; live: boolean }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const clientId = useRef<string>(crypto.randomUUID());
  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    if (!live) return void toast.message("Sending your own message needs live mode");
    setSending(true);
    try {
      await sendOwnerMessage(conversationId, body, clientId.current);
      setText("");
      clientId.current = crypto.randomUUID();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  };
  return (
    <form
      className="flex items-end gap-2 border-t border-line px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void send();
          }
        }}
        rows={1}
        maxLength={1200}
        placeholder="Write your own reply…"
        aria-label="Your own reply"
        className="max-h-32 min-h-10 flex-1 resize-y rounded-2xl border border-line-strong bg-surface-2 px-3 py-2 text-[13.5px] text-fg placeholder:text-muted focus:outline-2 focus:outline-amber"
      />
      <button
        type="submit"
        disabled={!text.trim() || sending}
        title="Send now (⌘↵)"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-crema text-ink transition-opacity disabled:opacity-40"
      >
        <SendHorizontal className="size-4" aria-hidden />
        <span className="sr-only">Send</span>
      </button>
    </form>
  );
}
