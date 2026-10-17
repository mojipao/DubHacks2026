"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useStore } from "@/lib/data/store";
import { maskHandle, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ConversationThread() {
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
      <div className="flex h-40 items-center justify-center border-t border-line px-3 text-[13px] text-muted">
        Select a conversation
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-line">
      <div className="px-3 py-2">
        <div className="text-[14px] font-semibold text-fg">
          {conv.customerName ?? maskHandle(conv.handle)}
        </div>
        <div className="font-mono text-[11px] text-muted">
          {maskHandle(conv.handle)} · {conv.platform}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "max-w-[92%] rounded-[14px] px-3 py-2 text-[14px] leading-snug",
              m.direction === "inbound"
                ? "bg-[color-mix(in_srgb,var(--sky)_22%,var(--panel))] text-fg"
                : "ml-auto bg-panel border border-line text-fg",
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
