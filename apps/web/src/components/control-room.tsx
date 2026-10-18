"use client";

import { useEffect, useState } from "react";
import { AssistantView } from "@/components/assistant/assistant-view";
import { Frieze } from "@/components/frieze";
import { OrdersView } from "@/components/orders/orders-view";
import { PeopleView } from "@/components/people/people-view";
import { PhoneSimulator } from "@/components/phone-simulator";
import { ShortcutHelp } from "@/components/shortcut-help";
import { TodayView } from "@/components/today/today-view";
import { TopBar } from "@/components/top-bar";
import { VIEWS, ViewTabs, type View } from "@/components/view-tabs";
import { useStore } from "@/lib/data/store";

const LEGACY_TABS: Record<string, View> = { pass: "orders", conversations: "people", customers: "people", assistant: "ask" };

function initialView(): View {
  if (typeof window === "undefined") return "orders";
  const t = new URLSearchParams(window.location.search).get("tab") ?? "";
  if (VIEWS.some((v) => v.id === t)) return t as View;
  return LEGACY_TABS[t] ?? "orders";
}

export function ControlRoom() {
  const { state, focusProposal, selectConversation } = useStore();
  const [view, setViewState] = useState<View>(initialView);
  const [helpOpen, setHelpOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sim") === "1");

  // The view lives in the URL, so a reload or a shared link opens the same place.
  const setView = (next: View) => {
    setViewState(next);
    const url = new URL(window.location.href);
    if (next === "orders") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  const openPerson = (conversationId: string) => {
    selectConversation(conversationId);
    setView("people");
  };

  const openOrder = (conversationId: string) => {
    const ticket = state.proposals.find((p) => p.conversationId === conversationId && p.status === "pending");
    if (ticket) focusProposal(ticket.id);
    setView("orders");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey || simOpen || helpOpen) return;
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const waiting = state.proposals.filter((p) => p.status === "pending" && !p.parentProposalId).length;

  return (
    <div className="flex h-dvh min-h-[640px] flex-col">
      <div className="shrink-0">
        <TopBar
          onOpenSim={() => setSimOpen(true)}
          onOpenKeys={() => setHelpOpen(true)}
          tabs={<ViewTabs view={view} onChange={setView} waiting={waiting} />}
        />
        <Frieze />
      </div>

      <main className="flex min-h-0 flex-1">
        {view === "orders" && <OrdersView onOpenSim={() => setSimOpen(true)} onOpenPerson={openPerson} blocked={simOpen || helpOpen} />}
        {view === "today" && <TodayView />}
        {view === "people" && <PeopleView onOpenOrder={openOrder} />}
        {view === "ask" && <AssistantView />}
      </main>

      <PhoneSimulator open={simOpen} onOpenChange={setSimOpen} />
      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
