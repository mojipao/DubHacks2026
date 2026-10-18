"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Shield } from "lucide-react";
import { isGuardFlag } from "@/lib/flags";
import { useFlash } from "@/lib/use-flash";
import { useStore } from "@/lib/data/store";
import { maskHandle, shortRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ConversationList() {
  const { state, selectConversation } = useStore();
  const reduce = useReducedMotion();
  const flashing = useFlash(
    state.conversations.map((c) => ({ id: c.id, sig: c.lastMessageAt })),
  );
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
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="text-[24px] leading-none font-medium tracking-[-0.03em] text-fg">Conversations</h2>
        <span className="font-mono text-[11px] text-muted tabular-nums">{state.conversations.length}</span>
      </div>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {state.conversations.map((c) => {
          const selected = state.selectedConversationId === c.id;
          const name = c.role === "owner" ? "Owner" : (c.customerName ?? maskHandle(c.handle));
          return (
            <motion.li key={c.id} layout={!reduce} initial={false}>
              <button
                type="button"
                onClick={() => selectConversation(c.id)}
                aria-current={selected || undefined}
                className={cn(
                  "relative flex w-full items-start gap-2.5 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white",
                  selected && "bg-white shadow-[0_0_0_1px_var(--line),0_6px_16px_-10px_rgba(23,23,23,0.25)]",
                  flashing.has(c.id) && "bg-sky/10",
                )}
              >
                {selected && <span className="absolute top-3 bottom-3 left-0 w-1 rounded-full bg-lime ring-1 ring-ink/10" aria-hidden />}
                <Avatar name={name} owner={c.role === "owner"} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-medium text-fg">{name}</span>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-muted">
                      {shortRelativeTime(c.lastMessageAt)}
                      {c.hasPendingTicket && <span className="size-2 rounded-full bg-lime ring-1 ring-ink/20" aria-label="Ticket pending" />}
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{c.lastPreview}</span>
                  <span className="mt-1.5 inline-flex items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-px text-[10px] font-medium tracking-wide",
                        c.platform === "imessage" ? "border-sky/30 text-sky" : "border-line-strong text-muted",
                      )}
                    >
                      {c.platform === "imessage" ? "iMessage" : "simulated"}
                    </span>
                    {guarded.has(c.id) && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-tomato/10 px-1.5 py-px text-[10px] font-medium text-tomato">
                        <Shield className="size-2.5" /> Guard
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

const AVATAR_TINTS = ["#f5b14c", "#6aaeff", "#49c08a", "#e58fb8", "#b7a1ff", "#ef6a4c"];

function Avatar({ name, owner }: { name: string; owner?: boolean }) {
  const letters = name.startsWith("+")
    ? "#"
    : name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const tint = owner ? "#49c08a" : AVATAR_TINTS[h % AVATAR_TINTS.length];
  return (
    <span
      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: `${tint}22`, color: tint, boxShadow: `inset 0 0 0 1px ${tint}40` }}
      aria-hidden
    >
      {letters}
    </span>
  );
}
