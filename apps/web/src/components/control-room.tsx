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
import { VIEWS, ViewTabs, type View } from "@/components/view-tabs";
import { BUSINESS } from "@/lib/business";
import { localDateKey } from "@/lib/format";
import { useStore } from "@/lib/data/store";
import { toast } from "sonner";

export function ControlRoom() {
  const { state, focusProposal, approve, reject } = useStore();
  const [drawer, setDrawer] = useState<DrawerTarget>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [view, setViewState] = useState<View>(() => {
    if (typeof window === "undefined") return "pass";
    const t = new URLSearchParams(window.location.search).get("tab");
    return VIEWS.some((v) => v.id === t) ? (t as View) : "pass";
  });
  // Keep the tab in the URL so a reload (or a link to ?tab=today) lands on the same view.
  const setView = (next: View) => {
    setViewState(next);
    const url = new URL(window.location.href);
    if (next === "pass") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };
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
      const byKey = VIEWS.find((v) => v.key === e.key);
      if (byKey) {
        e.preventDefault();
        setView(byKey.id);
        return;
      }
      // Ticket shortcuts only act where the tickets are.
      if (view !== "pass" || !focused) return;
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
  }, [state.proposals, state.focusedProposalId, approve, reject, focusProposal, drawer, simOpen, helpOpen, view]);

  const dayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS.timezone,
    weekday: "short",
    month: "numeric",
    day: "numeric",
  }).format(new Date(state.now));

  const todayKey = localDateKey(state.now);
  const counts = {
    pass: { n: state.proposals.filter((p) => p.status === "pending").length, alert: true },
    conversations: { n: state.conversations.filter((c) => c.hasPendingTicket).length },
    today: {
      n: state.orders.filter(
        (o) => localDateKey(o.pickupAt) === todayKey && (o.status === "paid" || o.status === "awaiting_payment"),
      ).length,
    },
  };

  const openTicketFor = (conversationId: string) => {
    const ticket = state.proposals.find((p) => p.conversationId === conversationId && p.status === "pending");
    if (!ticket) return;
    focusProposal(ticket.id);
    setView("pass");
  };

  return (
    <div className="flex h-dvh min-h-[640px] flex-col gap-2.5 p-2.5">
      <div className="surface rounded-xl">
        <TopBar onOpenSim={() => setSimOpen(true)} />
        <ViewTabs view={view} onChange={setView} counts={counts} />
        <FrictionStrip />
      </div>

      <div className="flex min-h-0 flex-1">
        {view === "pass" && (
          <div id="view-pass" role="tabpanel" className="flex min-h-0 min-w-0 flex-1">
            <PassRail onOpenSim={() => setSimOpen(true)} drawer={drawer} onDrawer={setDrawer} />
          </div>
        )}

        {view === "conversations" && (
          <div id="view-conversations" role="tabpanel" className="flex min-h-0 min-w-0 flex-1 gap-2.5">
            <aside className="surface flex w-[340px] shrink-0 flex-col overflow-hidden rounded-xl min-[1400px]:w-[380px]">
              <ConversationList />
            </aside>
            <section className="surface flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl">
              <ConversationThread standalone onOpenTicket={openTicketFor} />
            </section>
          </div>
        )}

        {view === "today" && (
          <div id="view-today" role="tabpanel" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="grid gap-2.5 lg:grid-cols-[1.1fr_1fr]">
              <section className="surface rounded-xl px-5 py-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="eyebrow">Today</h2>
                  <span className="font-mono text-[12px] text-fg/80">{dayLabel}</span>
                </div>
                <PickupsBoard />
              </section>
              <div className="flex flex-col gap-2.5">
                <TodayRevenue />
                <section className="surface rounded-xl px-5 py-4">
                  <StockBars />
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
      <EventTicker />
      <PhoneSimulator open={simOpen} onOpenChange={setSimOpen} />
      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
