"use client";

import { useEffect, useState } from "react";
import { ConversationList } from "@/components/conversations/list";
import { ConversationThread } from "@/components/conversations/thread";
import { LeadsView } from "@/components/leads/leads-view";
import { PassRail, type DrawerTarget } from "@/components/pass/rail";
import { PhoneSimulator } from "@/components/phone-simulator";
import { ShortcutHelp } from "@/components/shortcut-help";
import { Activity } from "@/components/today/activity";
import { PickupsBoard } from "@/components/today/pickups";
import { TodayRevenue } from "@/components/today/revenue";
import { TimeSaved } from "@/components/today/time-saved";
import { StockBars } from "@/components/today/stock-bars";
import { TopBar } from "@/components/top-bar";
import { VIEWS, ViewTabs, type View } from "@/components/view-tabs";
import { BUSINESS } from "@/lib/business";
import { localDateKey } from "@/lib/format";
import { useStore } from "@/lib/data/store";
import { toast } from "sonner";

export function ControlRoom() {
  const { state, focusProposal, selectConversation, approve, reject } = useStore();
  const [drawer, setDrawer] = useState<DrawerTarget>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [view, setViewState] = useState<View>(() => {
    if (typeof window === "undefined") return "pass";
    const t = new URLSearchParams(window.location.search).get("tab");
    return VIEWS.some((v) => v.id === t) ? (t as View) : "pass";
  });
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

  // When a ticket is focused, keep its conversation selected so the thread matches.
  useEffect(() => {
    const focused = state.proposals.find((p) => p.id === state.focusedProposalId);
    if (focused?.conversationId && focused.conversationId !== state.selectedConversationId) {
      selectConversation(focused.conversationId);
    }
  }, [state.focusedProposalId, state.proposals, state.selectedConversationId, selectConversation]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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
      if (view !== "pass" || !focused) return;
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        void approve(focused.id)
          .then(() => toast.success("Approved"))
          .catch((err: Error) => toast.error(err.message));
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        void reject(focused.id)
          .then(() => toast.message("Skipped"))
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
    customers: { n: 0 },
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

  const openConversation = (conversationId: string) => {
    selectConversation(conversationId);
    setView("pass");
  };

  return (
    <div className="flex h-dvh min-h-[640px] flex-col px-4 pt-2 pb-4 md:px-8">
      <div className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
        <TopBar
          onOpenSim={() => setSimOpen(true)}
          onOpenKeys={() => setHelpOpen(true)}
          tabs={<ViewTabs view={view} onChange={setView} counts={counts} />}
        />
      </div>

      <div className="flex min-h-0 flex-1 pt-5">
        {view === "pass" && (
          <div id="view-pass" role="tabpanel" className="flex min-h-0 min-w-0 flex-1 gap-0">
            <aside className="flex w-[min(42%,420px)] shrink-0 flex-col overflow-hidden border-r border-line pr-5">
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="max-h-[38%] min-h-[120px] overflow-hidden border-b border-line pb-3">
                  <ConversationList />
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <ConversationThread standalone onOpenTicket={openTicketFor} />
                </div>
              </div>
            </aside>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-6">
              <PassRail
                compact
                onOpenSim={() => setSimOpen(true)}
                drawer={drawer}
                onDrawer={setDrawer}
              />
            </div>
          </div>
        )}

        {view === "conversations" && (
          <div id="view-conversations" role="tabpanel" className="flex min-h-0 min-w-0 flex-1 gap-8">
            <aside className="flex w-[300px] shrink-0 flex-col overflow-hidden border-r border-line min-[1400px]:w-[340px]">
              <ConversationList />
            </aside>
            <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <ConversationThread standalone onOpenTicket={openTicketFor} />
            </section>
          </div>
        )}

        {view === "customers" && (
          <div id="view-customers" role="tabpanel" className="flex min-h-0 min-w-0 flex-1">
            <LeadsView onOpenConversation={openConversation} />
          </div>
        )}

        {view === "today" && (
          <div id="view-today" role="tabpanel" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="mb-8 flex items-baseline justify-between">
              <h1 className="heading text-[40px] text-fg">Today</h1>
              <span className="text-[15px] text-muted">{dayLabel}</span>
            </div>
            <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]">
              <div className="flex flex-col gap-10">
                <section>
                  <PickupsBoard />
                </section>
                <Activity />
              </div>
              <div className="flex flex-col gap-10">
                <TodayRevenue />
                <TimeSaved />
                <section>
                  <StockBars />
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
      <PhoneSimulator open={simOpen} onOpenChange={setSimOpen} />
      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
