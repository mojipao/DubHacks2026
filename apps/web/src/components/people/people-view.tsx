"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PAYMENT_LINK_TOKEN } from "@boh/shared";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/data/store";
import type { ContactStage, UiContact, UiMessage } from "@/lib/data/types";
import { money, shortRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STAGE: Record<Exclude<ContactStage, "owner">, { label: string; tone: string }> = {
  lead: { label: "New", tone: "text-muted" },
  ordered: { label: "Ordered", tone: "text-qishr-ink" },
  paid: { label: "Paid", tone: "text-terrace" },
  regular: { label: "Regular", tone: "text-brew" },
};

/** Everyone who has texted the shop, and the full conversation with each (lane 2's /contacts and history routes). */
export function PeopleView({ onOpenOrder }: { onOpenOrder: (conversationId: string) => void }) {
  const { state, mode, listContacts, loadHistory, sendMessage, selectConversation } = useStore();
  const [contacts, setContacts] = useState<UiContact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Refresh when a text, an order, or a ticket changes; the realtime store already tells us.
  const signal = `${state.messages.length}:${state.orders.map((o) => o.status).join("")}:${state.proposals.length}`;
  useEffect(() => {
    let live = true;
    listContacts()
      .then((rows) => {
        if (!live) return;
        setContacts(rows.filter((r) => r.role !== "owner"));
        setError(null);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [listContacts, signal]);

  const rows = (contacts ?? []).filter((r) => {
    const q = query.trim().toLowerCase();
    return !q || (r.name ?? "").toLowerCase().includes(q) || r.handleMasked.includes(q) || (r.lastMessage?.body ?? "").toLowerCase().includes(q);
  });
  const selectedId = state.selectedConversationId && rows.some((r) => r.conversationId === state.selectedConversationId)
    ? state.selectedConversationId
    : rows[0]?.conversationId;
  const person = rows.find((r) => r.conversationId === selectedId);

  const exportCsv = () => {
    if (mode === "live") {
      // The server streams the file with its own name; a download link hands it straight to the browser.
      const a = document.createElement("a");
      a.href = "/api/contacts?format=csv";
      a.download = "";
      a.click();
      return;
    }
    // Mock mode has no server, so build the same columns here.
    const cols = ["name", "handle", "stage", "platform", "lastMessageAt", "inbound", "outbound", "paidCents", "awaitingCents"];
    const cell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const csv = [
      cols.join(","),
      ...(contacts ?? []).map((r) =>
        [r.name, r.handleMasked, r.stage, r.platform, r.lastMessageAt, r.messages.inbound, r.messages.outbound, r.orders.paidCents, r.orders.awaitingCents]
          .map(cell)
          .join(","),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div id="view-people" role="tabpanel" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <section className="flex max-h-[45dvh] shrink-0 flex-col lg:max-h-none lg:w-[36%] lg:max-w-[480px] lg:min-w-[340px]">
        <div className="px-6 pt-7 pb-4">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="heading text-[34px] text-ink">People</h1>
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brew hover:underline">
              <Download className="size-4" /> Export
            </button>
          </div>
          <p className="mt-1 text-[15px] text-muted">Everyone who has texted the shop.</p>
          <label className="mt-4 flex h-10 items-center gap-2 rounded-full border border-line-strong bg-paper px-4 focus-within:border-brew">
            <Search className="size-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a name or message"
              aria-label="Find a person"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none"
            />
          </label>
        </div>
        {error ? (
          <p className="px-6 text-[14px] text-qamar">Couldn&apos;t load people: {error}</p>
        ) : contacts === null ? (
          <p className="px-6 text-[14px] text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-6 text-[14px] text-muted">{query ? "No one matches that." : "No one has texted yet."}</p>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto border-t border-line">
            {rows.map((r) => {
              const stage = r.stage === "owner" ? null : STAGE[r.stage];
              return (
                <li key={r.conversationId}>
                  <button
                    type="button"
                    onClick={() => selectConversation(r.conversationId)}
                    aria-current={r.conversationId === selectedId || undefined}
                    className={cn("block w-full px-6 py-3.5 text-left transition-colors duration-150", r.conversationId === selectedId ? "bg-paper" : "hover:bg-paper/60")}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[16px] font-bold text-ink">{r.name ?? r.handleMasked}</span>
                      <span className="shrink-0 text-[13px] text-muted">{shortRelativeTime(r.lastMessageAt)}</span>
                    </span>
                    <span className="mt-0.5 flex items-baseline gap-2 text-[14px]">
                      {stage && r.pendingTickets === 0 && <span className={cn("shrink-0 font-semibold", stage.tone)}>{stage.label}</span>}
                      <span className="truncate text-muted">{r.lastMessage?.body ?? ""}</span>
                    </span>
                    {r.pendingTickets > 0 && <span className="mt-1 block text-[13px] font-semibold text-qishr-ink">An order is waiting for you</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex min-h-[70dvh] min-w-0 flex-1 border-t border-line lg:min-h-0 lg:border-t-0 lg:border-l">
        {person ? (
          <Thread key={person.conversationId} person={person} onOpenOrder={onOpenOrder} loadHistory={loadHistory} sendMessage={sendMessage} />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-paper text-[15px] text-muted">Pick someone to read your conversation with them.</div>
        )}
      </section>
    </div>
  );
}

function Thread({
  person,
  onOpenOrder,
  loadHistory,
  sendMessage,
}: {
  person: UiContact;
  onOpenOrder: (conversationId: string) => void;
  loadHistory: (conversationId: string, before?: string) => Promise<{ messages: UiMessage[]; hasMore: boolean }>;
  sendMessage: (conversationId: string, text: string, clientId: string) => Promise<void>;
}) {
  const { state } = useStore();
  const [earlier, setEarlier] = useState<{ messages: UiMessage[]; hasMore: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => {
    const byId = new Map<string, UiMessage>();
    for (const m of earlier?.messages ?? []) byId.set(m.id, m);
    for (const m of state.messages) if (m.conversationId === person.conversationId) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }, [earlier, state.messages, person.conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const loadEarlier = async () => {
    setLoading(true);
    try {
      const res = await loadHistory(person.conversationId, messages[0]?.createdAt);
      setEarlier((prev) => ({ messages: [...res.messages, ...(prev?.messages ?? [])], hasMore: res.hasMore }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load earlier messages");
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    if (body.includes(PAYMENT_LINK_TOKEN)) {
      toast.error("Payment links only come from approving an order.");
      return;
    }
    setSending(true);
    try {
      await sendMessage(person.conversationId, body, crypto.randomUUID());
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  };

  const spent = person.orders.paidCents;
  const due = person.orders.awaitingCents;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-paper">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-8 pt-6 pb-4">
        <div className="min-w-0">
          <h2 className="heading truncate text-[30px] text-ink">{person.name ?? person.handleMasked}</h2>
          <p className="mt-1 text-[14px] text-muted">
            {person.name ? `${person.handleMasked} · ` : "No name yet · "}
            first texted {shortRelativeTime(person.firstSeenAt)}
          </p>
        </div>
        <p className="text-[14px] text-ink/85">
          {spent > 0 && <span className="font-semibold text-terrace">{money(spent)} paid</span>}
          {spent > 0 && due > 0 && " · "}
          {due > 0 && <span className="text-qishr-ink">{money(due)} waiting on payment</span>}
          {person.orders.historyOrders > 0 && <span className="text-muted"> · {person.orders.historyOrders} past orders</span>}
        </p>
      </header>

      {person.pendingTickets > 0 && (
        <button
          type="button"
          onClick={() => onOpenOrder(person.conversationId)}
          className="flex items-center justify-between border-b border-line bg-[color-mix(in_srgb,var(--qishr)_14%,var(--paper))] px-8 py-3 text-left text-[15px] font-semibold text-ink hover:bg-[color-mix(in_srgb,var(--qishr)_22%,var(--paper))]"
        >
          An order from {person.name?.split(" ")[0] ?? "them"} is waiting for you
          <span className="text-brew">Open it</span>
        </button>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="space-y-2.5">
          {(earlier ? earlier.hasMore : messages.length > 0) && (
            <div className="flex justify-center pb-3">
              <button
                type="button"
                onClick={() => void loadEarlier()}
                disabled={loading}
                className="text-[13px] font-semibold text-brew hover:underline disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load earlier messages"}
              </button>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col", m.direction === "inbound" ? "items-start" : "items-end")}>
              <p
                className={cn(
                  "max-w-[min(80%,36rem)] rounded-2xl px-4 py-2.5 text-[15px] leading-snug whitespace-pre-wrap",
                  m.direction === "inbound" ? "rounded-bl-md bg-bubble-in text-ink" : "rounded-br-md bg-bubble-out text-ink",
                )}
              >
                {m.body}
              </p>
              <span className="mt-1 px-1 text-[12px] text-muted">{shortRelativeTime(m.createdAt)}</span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <form
        className="flex items-end gap-3 border-t border-line px-8 py-4"
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
          placeholder={`Message ${person.name?.split(" ")[0] ?? "them"}`}
          aria-label="Your message"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line-strong bg-paper px-4 py-2.5 text-[15px] text-ink focus:border-brew focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="inline-flex h-11 shrink-0 items-center rounded-full bg-brew px-6 text-[15px] font-semibold text-paper hover:bg-[#4a2711] disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
