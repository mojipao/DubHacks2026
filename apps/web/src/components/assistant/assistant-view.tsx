"use client";

import { useState } from "react";
import { AlertTriangle, Phone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { askAgent, sendCampaign, syncCalls, type AssistantAnswer } from "@/lib/actions";
import { useStore } from "@/lib/data/store";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "How's our stock?",
  "How much ghee is left?",
  "Text regulars: milk cake is buy one get one today only",
  "Text everyone: we're open late Friday for Yemeni coffee night",
  "Call Maya about her order",
];

type Turn = { id: string; question: string; answer: AssistantAnswer | null; error?: string };

/** The owner asking the agent things: stock and inventory, texts to customers, calls. */
export function AssistantView() {
  const { mode } = useStore();
  const [text, setText] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    if (mode === "mock") return void toast.message("Asking the agent needs live mode");
    const id = crypto.randomUUID();
    setTurns((t) => [{ id, question, answer: null }, ...t]);
    setText("");
    setBusy(true);
    try {
      const answer = await askAgent(question);
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, answer } : x)));
    } catch (e) {
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: e instanceof Error ? e.message : "Something went wrong" } : x)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="view-ask" role="tabpanel" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
    <div className="mx-auto w-full max-w-4xl px-4 pt-7 pb-12 sm:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="heading text-[34px] text-ink">Ask the agent</h1>
          <p className="mt-1 max-w-[60ch] text-[15px] leading-relaxed text-muted">
            Check stock, text customers, or ask for a call. We can&apos;t dial out yet, so &ldquo;call Maya&rdquo; texts her a tap-to-call-back. Transcripts land in that person&apos;s People thread; phone orders still go to Orders.

          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            mode === "mock"
              ? toast.message("Needs live mode")
              : void syncCalls()
                  .then((r) => toast.success(r.imported ? `${r.imported} new call${r.imported > 1 ? "s" : ""} added in People` : "No new calls"))
                  .catch((e: Error) => toast.error(e.message))
          }
          className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong px-3.5 text-[14px] font-semibold text-ink hover:bg-surface-2"
        >
          <RefreshCw className="size-3.5" aria-hidden /> Check for new calls
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(text);
        }}
        className="flex items-center gap-2 rounded-full border border-line-strong bg-paper py-1.5 pr-1.5 pl-5 focus-within:border-brew"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. how much ghee is left?"
          aria-label="Ask the agent"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[16px] text-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          className="h-10 rounded-full bg-brew px-6 text-[15px] font-semibold text-paper hover:bg-[#4a2711] disabled:opacity-40"
        >
          Ask
        </button>
      </form>
      {turns.length === 0 && (
        <div className="mt-6">
          <p className="text-[14px] text-muted">Try one of these</p>
          <ul className="mt-1 divide-y divide-line border-y border-line">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => void ask(s)} className="w-full py-2.5 text-left text-[15px] text-ink hover:text-brew">
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 divide-y divide-line">
        {turns.map((t) => (
          <article key={t.id} className="py-5 first:pt-0">
            <p className="text-[14px] text-muted">You asked: {t.question}</p>
            {t.error ? (
              <p className="mt-2 text-[15px] text-qamar">{t.error}</p>
            ) : !t.answer ? (
              <p className="mt-2 text-[14px] text-muted">Checking…</p>
            ) : (
              <Answer answer={t.answer} />
            )}
          </article>
        ))}
      </div>
    </div>
    </div>
  );
}

function Answer({ answer }: { answer: AssistantAnswer }) {
  if (answer.kind === "stock") return <StockAnswer answer={answer} />;
  if (answer.kind === "campaign") return <CampaignAnswer answer={answer} />;
  if (answer.kind === "call")
    return (
      <p className={cn("mt-2 flex items-start gap-2 text-[16px] leading-snug", answer.placed || answer.callback ? "text-ink" : "text-qamar")}>
        {answer.placed || answer.callback ? <Phone className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
        {answer.say}
      </p>
    );
  return <p className="mt-2 text-[16px] text-ink">{answer.say}</p>;
}

function StockAnswer({ answer }: { answer: Extract<AssistantAnswer, { kind: "stock" }> }) {
  const day = answer.products[0]?.date;
  return (
    <div className="mt-2">
      <p className="text-[16px] leading-snug text-ink">{answer.say}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-1 font-medium">Ingredient</th>
              <th className="pb-1 text-right font-medium">On hand</th>
              <th className="pb-1 text-right font-medium">Reorder at</th>
            </tr>
          </thead>
          <tbody>
            {answer.ingredients.map((i) => (
              <tr key={i.id} className={cn("border-t border-line", i.low && "text-qamar")}>
                <td className="py-1">{i.name}</td>
                <td className="py-1 text-right tabular">
                  {i.onHand} {i.unit}
                  {i.onOrder > 0 && <span className="text-qishr-ink"> +{i.onOrder}</span>}
                </td>
                <td className="py-1 text-right tabular">{i.reorderPoint}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {day && (
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="pb-1 font-medium">Can still make on {day}</th>
                <th className="pb-1 text-right font-medium">Left</th>
              </tr>
            </thead>
            <tbody>
              {answer.products.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-1">{p.name}</td>
                  <td className={cn("py-1 text-right tabular", p.capacity && p.left / p.capacity < 0.35 && "text-qamar")}>
                    {p.left} / {p.capacity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CampaignAnswer({ answer }: { answer: Extract<AssistantAnswer, { kind: "campaign" }> }) {
  const [text, setText] = useState(answer.text);
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(answer.recipients.filter((r) => r.reachable && r.conversationId).map((r) => r.conversationId!)),
  );
  const [sent, setSent] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!picked.size || sending) return;
    setSending(true);
    try {
      const res = await sendCampaign(text, [...picked]);
      setSent(res.sent);
      toast.success(`Sent to ${res.sent}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2">
      <p className="text-[16px] leading-snug text-ink">{answer.say}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={1000}
        aria-label="Message to send"
        disabled={sent !== null}
        className="mt-3 w-full resize-y rounded-2xl border border-line-strong bg-paper px-4 py-2.5 text-[15px] text-ink focus:border-brew focus:outline-none disabled:opacity-60"
      />
      <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
        {answer.recipients.map((r, i) => {
          const id = r.conversationId;
          return (
            <li key={`${id ?? r.name}-${i}`} className="flex items-start gap-2.5 text-[14px]">
              <input
                type="checkbox"
                className="mt-0.5"
                disabled={!r.reachable || !id || sent !== null}
                checked={Boolean(id && picked.has(id))}
                onChange={(e) =>
                  setPicked((s) => {
                    const next = new Set(s);
                    if (id) {
                      if (e.target.checked) next.add(id);
                      else next.delete(id);
                    }
                    return next;
                  })
                }
                aria-label={`Send to ${r.name}`}
              />
              <span className="min-w-0">
                <span className={cn("font-medium", r.reachable ? "text-fg" : "text-muted")}>{r.name}</span>
                <span className="ml-2 text-[13px] text-muted">{r.handleMasked}</span>
                <span className={cn("block text-[12px]", r.reachable ? "text-muted" : "text-qamar")}>{r.note}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void send()}
          disabled={!picked.size || sending || sent !== null || !text.trim()}
          className="inline-flex h-10 items-center rounded-full bg-brew px-6 text-[15px] font-semibold text-paper hover:bg-[#4a2711] disabled:opacity-40"
        >
          {sent !== null ? `Sent to ${sent}` : `Send to ${picked.size}`}
        </button>
        <span className="text-[13px] text-muted">Each text is logged in that customer&apos;s thread.</span>
      </div>
    </div>
  );
}
