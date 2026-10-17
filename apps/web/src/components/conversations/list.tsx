"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Shield } from "lucide-react";
import { isGuardFlag } from "@/lib/flags";
import { useStore } from "@/lib/data/store";
import { maskHandle, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ConversationList() {
  const { state, selectConversation } = useStore();
  const reduce = useReducedMotion();
  const guarded = useMemo(
    () =>
      new Set(
        state.proposals
          .filter((p) => p.riskFlags.some(isGuardFlag))
          .map((p) => p.conversationId),
      ),
    [state.proposals],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-3 py-2">
        <h2 className="font-mono text-[12px] tracking-[0.2em] text-muted uppercase">
          Conversations
        </h2>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {state.conversations.map((c) => {
          const selected = state.selectedConversationId === c.id;
          const name = c.role === "owner" ? "Owner" : (c.customerName ?? maskHandle(c.handle));
          return (
            <motion.li
              key={c.id}
              layout
              initial={false}
              animate={
                reduce
                  ? undefined
                  : {
                      backgroundColor: selected
                        ? "rgba(242,165,65,0.08)"
                        : "transparent",
                    }
              }
            >
              <button
                type="button"
                onClick={() => selectConversation(c.id)}
                className={cn(
                  "flex w-full items-start gap-2 border-b border-line/70 px-3 py-3 text-left transition-colors",
                  selected && "bg-amber/10",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    c.hasPendingTicket ? "bg-amber" : "bg-transparent border border-line",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-semibold text-fg">
                      {name}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {relativeTime(c.lastMessageAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[13px] text-muted">
                    {c.lastPreview}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1">
                    <span
                      className={cn(
                        "rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide",
                        c.platform === "imessage"
                          ? "bg-sky/20 text-sky"
                          : "bg-line text-muted",
                      )}
                    >
                      {c.platform === "imessage" ? "iMessage" : "simulated"}
                    </span>
                    {c.role === "owner" && (
                      <span className="rounded bg-basil/20 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-basil">
                        owner
                      </span>
                    )}
                    {guarded.has(c.id) && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-tomato">
                        <Shield className="size-3" /> Guard
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
