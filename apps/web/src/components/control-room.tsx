"use client";

import { useEffect, useState } from "react";
import { ConversationList } from "@/components/conversations/list";
import { ConversationThread } from "@/components/conversations/thread";
import { FrictionStrip } from "@/components/friction-strip";
import { PassRail, type DrawerTarget } from "@/components/pass/rail";
import { PhoneSimulator } from "@/components/phone-simulator";
import { ShortcutHelp } from "@/components/shortcut-help";
import { EventTicker } from "@/components/ticker";
import { PickupsBoard } from "@/components/today/pickups";
import { TodayRevenue } from "@/components/today/revenue";
import { StockBars } from "@/components/today/stock-bars";
import { TopBar } from "@/components/top-bar";
import { BUSINESS } from "@/lib/business";
import { useStore } from "@/lib/data/store";
import { toast } from "sonner";

export function ControlRoom() {
  const { state, focusProposal, approve, reject } = useStore();
  const [drawer, setDrawer] = useState<DrawerTarget>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("sim") === "1";
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Shortcuts act on the pass only; an open drawer or simulator owns the keyboard.
      if (drawer || simOpen || helpOpen) return;

      const pending = state.proposals.filter((p) => p.status === "pending");
      const focused =
        pending.find((p) => p.id === state.focusedProposalId) ?? pending[0];

      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setSimOpen(true);
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
      if (!focused) return;
      const hasChildren = pending.some((p) => p.parentProposalId === focused.id);
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        void approve(focused.id, { includeLinked: hasChildren })
          .then(() => toast.success(hasChildren ? "Approved both" : "Approved"))
          .catch((err: Error) => toast.error(err.message));
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        void reject(focused.id, { includeLinked: hasChildren })
          .then(() => toast.message("86'd"))
          .catch((err: Error) => toast.error(err.message));
      }
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setDrawer({ id: focused.id, editing: focused.kind === "reply" });
      }
      if (e.key === "Enter") {
        e.preventDefault();
        setDrawer({ id: focused.id, editing: false });
      }
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        const idx = pending.findIndex((p) => p.id === focused.id);
        const next = pending[Math.min(pending.length - 1, idx + 1)];
        if (next) focusProposal(next.id);
      }
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        const idx = pending.findIndex((p) => p.id === focused.id);
        const prev = pending[Math.max(0, idx - 1)];
        if (prev) focusProposal(prev.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.proposals, state.focusedProposalId, approve, reject, focusProposal, drawer, simOpen, helpOpen]);

  const dayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS.timezone,
    weekday: "short",
    month: "numeric",
    day: "numeric",
  }).format(new Date(state.now));

  return (
    <div className="flex h-dvh min-h-[720px] flex-col">
      <TopBar onOpenSim={() => setSimOpen(true)} />
      <FrictionStrip />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[272px] shrink-0 flex-col border-r border-line bg-panel/30 min-[1400px]:w-[320px]">
          <div className="min-h-0 flex-[1.1]">
            <ConversationList />
          </div>
          <div className="min-h-0 flex-1">
            <ConversationThread />
          </div>
        </aside>

        <PassRail onOpenSim={() => setSimOpen(true)} drawer={drawer} onDrawer={setDrawer} />

        <aside className="w-[288px] shrink-0 overflow-y-auto bg-panel/30 px-4 py-3 min-[1400px]:w-[340px]">
          <h2 className="mb-3 font-mono text-[12px] tracking-[0.2em] text-muted uppercase">
            Today · {dayLabel}
          </h2>
          <PickupsBoard />
          <StockBars />
          <TodayRevenue />
        </aside>
      </div>
      <EventTicker />
      <PhoneSimulator open={simOpen} onOpenChange={setSimOpen} />
      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
