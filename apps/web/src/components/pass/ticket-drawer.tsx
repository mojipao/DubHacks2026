"use client";

import { useState } from "react";
import { PAYMENT_LINK_TOKEN, type ReplyPayload } from "@boh/shared";
import { TraceTimeline } from "@/components/pass/trace";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/data/store";
import type { UiProposal } from "@/lib/data/types";
import { toast } from "sonner";

export function TicketDrawer({
  proposal,
  open,
  onOpenChange,
}: {
  proposal: UiProposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { approve, reject, getTrace } = useStore();
  const [editing, setEditing] = useState(false);
  const [draftById, setDraftById] = useState<Record<string, string>>({});

  if (!proposal) return null;

  const replyText =
    proposal.kind === "reply" ? (proposal.payload as ReplyPayload).text : "";
  const text = draftById[proposal.id] ?? replyText;
  const trace = getTrace(proposal.triggerMessageId);
  const canEdit = proposal.status === "pending" && proposal.kind === "reply";
  const tooLong = text.length > 1200;
  const empty = text.trim().length === 0;
  const linkRemoved =
    proposal.kind === "reply" &&
    ((proposal.payload as ReplyPayload).orders?.length ?? 0) > 0 &&
    !text.includes(PAYMENT_LINK_TOKEN);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-line bg-panel text-fg sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle className="text-fg">{proposal.title}</SheetTitle>
          <SheetDescription className="text-muted">
            {proposal.summary}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-1 pb-8">
          <section>
            <h3 className="mb-2 text-[12px] font-semibold tracking-[0.16em] text-muted uppercase">
              Rationale
            </h3>
            <p className="text-[15px] font-semibold leading-snug text-fg">
              {proposal.rationale}
            </p>
          </section>

          {proposal.kind === "reply" && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[12px] font-semibold tracking-[0.16em] text-muted uppercase">
                  Draft
                </h3>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-amber"
                    onClick={() => setEditing((v) => !v)}
                  >
                    {editing ? "Preview" : "Edit"}
                  </Button>
                )}
              </div>
              {editing ? (
                <div>
                  <Textarea
                    value={text}
                    onChange={(e) =>
                      setDraftById((prev) => ({
                        ...prev,
                        [proposal.id]: e.target.value,
                      }))
                    }
                    className="min-h-40 border-line bg-bg font-mono text-[13px]"
                  />
                  <div className="mt-1 flex justify-between text-[12px] text-muted">
                    <span>
                      {linkRemoved && (
                        <span className="text-tomato">
                          Payment link token removed
                        </span>
                      )}
                    </span>
                    <span className={tooLong ? "text-tomato" : undefined}>
                      {text.length}/1200
                    </span>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-fg/90">
                  {text}
                </p>
              )}
            </section>
          )}

          <section>
            <h3 className="mb-2 text-[12px] font-semibold tracking-[0.16em] text-muted uppercase">
              Evidence
            </h3>
            <ul className="space-y-2">
              {proposal.evidence.map((e) => (
                <li
                  key={`${e.label}-${e.value}`}
                  className="rounded-md border border-line bg-bg/60 px-3 py-2"
                >
                  <div className="text-[13px] font-semibold text-fg">{e.label}</div>
                  <div className="text-[13px] text-muted">{e.value}</div>
                  {e.source && (
                    <div className="mt-1 font-mono text-[10px] text-muted">
                      {e.source.table}/{e.source.id}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-3 text-[12px] font-semibold tracking-[0.16em] text-muted uppercase">
              Trace
            </h3>
            <TraceTimeline steps={trace} />
          </section>

          {proposal.status === "pending" && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button
                className="bg-basil text-white hover:bg-basil/90"
                disabled={canEdit && (empty || tooLong)}
                onClick={async () => {
                  try {
                    await approve(proposal.id, {
                      editedText:
                        editing && proposal.kind === "reply" ? text : undefined,
                    });
                    onOpenChange(false);
                    toast.success("Approved");
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Approve failed",
                    );
                  }
                }}
              >
                Approve
              </Button>
              <Button
                variant="outline"
                className="border-tomato/40 text-tomato"
                onClick={async () => {
                  try {
                    await reject(proposal.id);
                    onOpenChange(false);
                    toast.message("Rejected");
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Reject failed",
                    );
                  }
                }}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
