"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/data/store";
import type { UiEvent } from "@/lib/data/types";
import { tickerTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const QUICK_TYPES = [
  { label: "All", value: "" },
  { label: "Approvals", value: "proposal." },
  { label: "Messages", value: "message." },
  { label: "Orders", value: "order." },
  { label: "Guard", value: "guard." },
  { label: "Agent steps", value: "agent.step" },
  { label: "Stock", value: "inventory." },
];

/** The trust claim, from events only: every outbound message must trace back to an owner approval. */
export function trustSummary(events: UiEvent[]) {
  const approved = events.filter((e) => e.type === "proposal.approved" && !e.data.retry);
  const approvedIds = new Set(approved.map((e) => e.subjectId));
  const sends = events.filter((e) => e.type === "message.sent");
  return {
    executed: events.filter((e) => e.type === "proposal.executed").length,
    approved: approved.length,
    approvedByText: approved.filter((e) => e.data.via === "imessage").length,
    sent: sends.length,
    sentWithoutApproval: sends.filter((e) => !approvedIds.has(String(e.data.proposalId ?? ""))).length,
  };
}

function actorTone(actor: string) {
  if (actor === "owner") return "text-basil";
  if (actor === "customer") return "text-sky";
  if (actor === "agent:guard") return "text-tomato";
  if (actor.startsWith("agent:")) return "text-amber";
  return "text-fg/80";
}

export function AuditTable() {
  const { state, mode } = useStore();
  const [actor, setActor] = useState("");
  const [type, setType] = useState("");
  const [subject, setSubject] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("subject") ?? ""),
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      state.events.filter((e) => {
        if (actor && !e.actor.includes(actor)) return false;
        if (type && !e.type.includes(type)) return false;
        if (subject && !(e.subjectId ?? "").includes(subject)) return false;
        return true;
      }),
    [state.events, actor, type, subject],
  );

  const trust = useMemo(() => trustSummary(state.events), [state.events]);

  return (
    <main className="min-h-dvh px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[12px] tracking-[0.18em] text-amber uppercase">
              Audit {mode === "mock" ? "· fixtures" : ""}
            </p>
            <h1 className="font-serif text-4xl text-fg">Every action, on the record</h1>
          </div>
          <Link href="/" className="text-[13px] text-amber hover:underline">
            ← Control room
          </Link>
        </div>

        <section
          aria-label="Trust summary"
          className="mb-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4"
        >
          {[
            { n: trust.executed, label: "actions executed" },
            {
              n: trust.approved,
              label: "approved by the owner",
              sub: trust.approvedByText > 0 ? `${trust.approvedByText} by text` : undefined,
            },
            { n: trust.sent, label: "messages sent" },
          ].map((s) => (
            <div key={s.label} className="bg-panel px-4 py-3">
              <div className="font-mono text-[26px] font-semibold text-fg tabular-nums">{s.n}</div>
              <div className="text-[13px] text-muted">
                {s.label}
                {s.sub ? <span className="text-basil"> · {s.sub}</span> : null}
              </div>
            </div>
          ))}
          <div
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              trust.sentWithoutApproval === 0 ? "bg-basil/15" : "bg-tomato/20",
            )}
          >
            <ShieldCheck
              className={cn(
                "size-7 shrink-0",
                trust.sentWithoutApproval === 0 ? "text-basil" : "text-tomato",
              )}
            />
            <div>
              <div
                className={cn(
                  "font-mono text-[26px] font-semibold tabular-nums",
                  trust.sentWithoutApproval === 0 ? "text-basil" : "text-tomato",
                )}
              >
                {trust.sentWithoutApproval}
              </div>
              <div className="text-[13px] text-fg/80">sent without approval</div>
            </div>
          </div>
        </section>

        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Event type">
          {QUICK_TYPES.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setType(q.value)}
              aria-pressed={type === q.value}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px] transition-colors",
                type === q.value
                  ? "border-amber bg-amber/15 text-amber"
                  : "border-line text-muted hover:text-fg",
              )}
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { value: actor, set: setActor, label: "Filter actor" },
            { value: type, set: setType, label: "Filter type" },
            { value: subject, set: setSubject, label: "Filter subject id" },
          ].map((f) => (
            <input
              key={f.label}
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              placeholder={f.label}
              aria-label={f.label}
              className="h-9 rounded-md border border-line bg-panel px-3 text-[13px] text-fg placeholder:text-muted"
            />
          ))}
          <span className="self-center font-mono text-[12px] text-muted">
            {filtered.length} of {state.events.length} events
          </span>
        </div>

        <div className="surface overflow-x-auto rounded-xl">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-panel font-mono text-[11px] tracking-wider text-muted uppercase">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted">
                    {state.loaded ? "No events match." : "Loading events…"}
                  </td>
                </tr>
              )}
              {filtered.map((e) => {
                const open = expanded === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr
                      className="cursor-pointer border-t border-line/80 hover:bg-panel/50"
                      onClick={() => setExpanded(open ? null : e.id)}
                      aria-expanded={open}
                    >
                      <td className="px-2 py-2 text-muted">
                        <ChevronRight
                          className={cn("size-3.5 transition-transform", open && "rotate-90")}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-muted">{tickerTime(e.at)}</td>
                      <td className={cn("px-3 py-2 font-mono", actorTone(e.actor))}>{e.actor}</td>
                      <td className="px-3 py-2 text-fg">{e.type}</td>
                      <td className="px-3 py-2 font-mono text-[12px] text-muted">
                        {e.subjectType ? `${e.subjectType}/${(e.subjectId ?? "").slice(0, 8)}` : "—"}
                      </td>
                      <td className="max-w-[360px] truncate px-3 py-2 text-[12px] text-muted">
                        {typeof e.data.summary === "string"
                          ? e.data.summary
                          : typeof e.data.via === "string"
                            ? `via ${e.data.via}`
                            : ""}
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-t border-line/50 bg-bg">
                        <td colSpan={6} className="px-3 py-3">
                          <div className="mb-2 font-mono text-[11px] text-muted">
                            {e.subjectType}/{e.subjectId}
                          </div>
                          <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed text-fg/80">
                            {JSON.stringify(e.data, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
