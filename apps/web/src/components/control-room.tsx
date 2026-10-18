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
          .then(() => toast.message(hasChildren ? "Skipped both" : "Skipped"))
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
    setView("conversations");
  };

  return (
    <div className="flex h-dvh min-h-[640px] flex-col gap-3 p-3">
      <div className="surface sticky top-3 z-30 rounded-full bg-surface/90 backdrop-blur-md">
        <TopBar
          onOpenSim={() => setSimOpen(true)}
          onOpenKeys={() => setHelpOpen(true)}
          tabs={<ViewTabs view={view} onChange={setView} counts={counts} />}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {view === "pass" && (
          <div id="view-pass" role="tabpanel" className="flex min-h-0 min-w-0 flex-1">
            <PassRail onOpenSim={() => setSimOpen(true)} drawer={drawer} onDrawer={setDrawer} />
          </div>
        )}

        {view === "conversations" && (
          <div id="view-conversations" role="tabpanel" className="flex min-h-0 min-w-0 flex-1 gap-3">
            <aside className="surface flex w-[330px] shrink-0 flex-col overflow-hidden rounded-[22px] min-[1400px]:w-[370px]">
              <ConversationList />
            </aside>
            <section className="surface flex min-w-0 flex-1 flex-col overflow-hidden rounded-[22px]">
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
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h1 className="heading text-[30px] text-fg">Today</h1>
              <span className="text-[15px] font-semibold text-muted">{dayLabel}</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
              <div className="flex flex-col gap-3">
                <section className="surface rounded-[22px] px-6 py-5">
                  <PickupsBoard />
                </section>
                <Activity />
              </div>
              <div className="flex flex-col gap-3">
                <TodayRevenue />
                <TimeSaved />
                <section className="surface rounded-[22px] px-6 py-5">
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
