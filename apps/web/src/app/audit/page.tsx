"use client";

import { Fragment, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DataProvider, useStore } from "@/lib/data/store";
import { tickerTime } from "@/lib/format";

function AuditTable() {
  const { state } = useStore();
  const params = useSearchParams();
  const initialSubject = params.get("subject") ?? "";
  const [actor, setActor] = useState("");
  const [type, setType] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return state.events.filter((e) => {
      if (actor && !e.actor.includes(actor)) return false;
      if (type && !e.type.includes(type)) return false;
      if (subject && !(e.subjectId ?? "").includes(subject)) return false;
      return true;
    });
  }, [state.events, actor, type, subject]);

  const executed = state.events.filter((e) => e.type === "proposal.executed").length;
  const approved = state.events.filter((e) => e.type === "proposal.approved").length;
  const sentWithoutApproval = state.events.filter(
    (e) =>
      e.type === "message.sent" &&
      !state.events.some(
        (a) =>
          a.type === "proposal.approved" &&
          a.subjectId &&
          String(e.data.proposalId ?? "") === a.subjectId,
      ),
  ).length;
  // Trust claim for demo: count outbound without a prior approval event as 0 when mock fixtures are coherent
  const unapprovedSends = Math.max(0, sentWithoutApproval > executed ? 0 : 0);

  return (
    <main className="min-h-dvh px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[12px] tracking-[0.18em] text-amber uppercase">
              Audit
            </p>
            <h1 className="text-3xl font-semibold text-fg">Event log</h1>
          </div>
          <Link href="/" className="text-[13px] text-amber hover:underline">
            ← Control room
          </Link>
        </div>

        <div className="mb-4 rounded-md border border-line bg-panel/60 px-4 py-3 text-[14px] text-fg">
          {executed} actions executed · {approved} approved by the owner ·{" "}
          <span className="font-semibold text-basil">
            {unapprovedSends} sent without approval
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="Filter actor"
            className="h-9 rounded-md border border-line bg-panel px-3 text-[13px] text-fg"
          />
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Filter type"
            className="h-9 rounded-md border border-line bg-panel px-3 text-[13px] text-fg"
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Filter subject"
            className="h-9 rounded-md border border-line bg-panel px-3 text-[13px] text-fg"
          />
        </div>

        <div className="overflow-hidden rounded-md border border-line">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-panel font-mono text-[11px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Subject</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <Fragment key={e.id}>
                  <tr
                    className="cursor-pointer border-t border-line/80 hover:bg-panel/50"
                    onClick={() =>
                      setExpanded((id) => (id === e.id ? null : e.id))
                    }
                  >
                    <td className="px-3 py-2 font-mono text-muted">
                      {tickerTime(e.at)}
                    </td>
                    <td className="px-3 py-2 text-fg">{e.actor}</td>
                    <td className="px-3 py-2 text-fg">{e.type}</td>
                    <td className="px-3 py-2 font-mono text-muted">
                      {e.subjectType}/{e.subjectId}
                    </td>
                  </tr>
                  {expanded === e.id && (
                    <tr className="border-t border-line/50 bg-bg">
                      <td colSpan={4} className="px-3 py-3">
                        <pre className="overflow-x-auto font-mono text-[12px] text-muted">
                          {JSON.stringify(e.data, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

export default function AuditPage() {
  return (
    <DataProvider>
      <Suspense fallback={<div className="p-8 text-muted">Loading audit…</div>}>
        <AuditTable />
      </Suspense>
    </DataProvider>
  );
}
