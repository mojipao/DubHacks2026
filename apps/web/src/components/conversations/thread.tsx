"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { GlowButton } from "@/components/glow-button";
import { useStore } from "@/lib/data/store";
import { maskHandle, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ConversationThread({
  standalone = false,
  onOpenTicket,
}: {
  /** Fills its own panel (the Conversations tab) instead of sitting under the list. */
  standalone?: boolean;
  onOpenTicket?: (conversationId: string) => void;
} = {}) {
  const { state } = useStore();
  const reduce = useReducedMotion();
  const conv = state.conversations.find(
    (c) => c.id === state.selectedConversationId,
  );
  const messages = useMemo(
    () =>
      state.messages
        .filter((m) => m.conversationId === state.selectedConversationId)
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    [state.messages, state.selectedConversationId],
  );

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
          <div className={cn("truncate font-medium text-fg", standalone ? "font-serif text-[24px] leading-tight font-normal" : "text-[14px]")}>
            {conv.role === "owner" ? "Owner" : (conv.customerName ?? maskHandle(conv.handle))}
          </div>
          <div className="font-mono text-[11px] text-muted">
            {maskHandle(conv.handle)} · {conv.platform}
          </div>
        </div>
        {onOpenTicket && conv.hasPendingTicket && (
          <GlowButton tone="amber" size="sm" className="shrink-0" onClick={() => onOpenTicket(conv.id)}>
            Ticket waiting · open in the pass
          </GlowButton>
        )}
      </div>
      <div className={cn("min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-3", standalone && "mx-auto w-full max-w-3xl px-6 py-5")}>
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "max-w-[90%] rounded-2xl px-3 py-2 text-[13.5px] leading-snug",
              m.direction === "inbound"
                ? "rounded-bl-md bg-[#1d2836] text-[#e6efff]"
                : "ml-auto rounded-br-md border border-line-strong bg-surface-2 text-fg",
            )}
          >
            <p className="whitespace-pre-wrap">{m.body}</p>
            <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-muted">
              <span>{relativeTime(m.createdAt)}</span>
              {m.approvedByOwner && m.direction === "outbound" && (
                <span>approved by owner</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
