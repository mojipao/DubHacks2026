"use client";

import { useState } from "react";
import { AlertTriangle, Phone, RefreshCw, Send, Sparkles } from "lucide-react";
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
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="heading text-[40px] text-fg">Ask the agent</h1>
          <p className="mt-1 max-w-[60ch] text-[15px] text-muted">
            Check stock and inventory, text customers about a special, or ask for a call. Texts are previewed first; nothing goes out until you press Send.
            You can also text these to the shop line from the owner&apos;s phone.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            mode === "mock"
              ? toast.message("Needs live mode")
              : void syncCalls()
                  .then((r) => toast.success(r.imported ? `${r.imported} new call${r.imported > 1 ? "s" : ""} added to Messages` : "No new calls"))
                  .catch((e: Error) => toast.error(e.message))
          }
          className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-[12px] font-semibold tracking-wide text-muted uppercase hover:text-fg"
        >
          <RefreshCw className="size-3.5" aria-hidden /> Check for new calls
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(text);
        }}
        className="flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 py-1.5 pr-1.5 pl-4"
      >
        <Sparkles className="size-4 shrink-0 text-amber" aria-hidden />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. how much ghee is left?"
          aria-label="Ask the agent"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] text-fg placeholder:text-muted focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          className="rounded-full bg-crema px-4 py-2 text-[13px] font-semibold text-ink disabled:opacity-40"
        >
          Ask
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void ask(s)}
            className="rounded-full border border-line px-3 py-1 text-[12.5px] text-muted hover:border-line-strong hover:text-fg"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-6 min-h-0 flex-1 space-y-4 overflow-y-auto pb-6">
        {turns.map((t) => (
          <article key={t.id} className="rounded-[22px] border border-line bg-panel px-5 py-4">
            <p className="font-mono text-[12px] text-muted">You asked: {t.question}</p>
            {t.error ? (
              <p className="mt-2 text-[14px] text-tomato">{t.error}</p>
            ) : !t.answer ? (
              <p className="mt-2 text-[14px] text-muted">Checking…</p>
            ) : (
              <Answer answer={t.answer} />
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function Answer({ answer }: { answer: AssistantAnswer }) {
  if (answer.kind === "stock") return <StockAnswer answer={answer} />;
  if (answer.kind === "campaign") return <CampaignAnswer answer={answer} />;
  if (answer.kind === "call")
    return (
      <p className={cn("mt-2 flex items-start gap-2 text-[15px] leading-snug", answer.placed ? "text-fg" : "text-amber")}>
        {answer.placed ? <Phone className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
        {answer.say}
      </p>
    );
  return <p className="mt-2 text-[15px] text-fg">{answer.say}</p>;
}

function StockAnswer({ answer }: { answer: Extract<AssistantAnswer, { kind: "stock" }> }) {
  const day = answer.products[0]?.date;
  return (
    <div className="mt-2">
      <p className="text-[15px] leading-snug text-fg">{answer.say}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-1 font-medium">Ingredient</th>
              <th className="pb-1 text-right font-medium">On hand</th>
              <th className="pb-1 text-right font-medium">Reorder at</th>
            </tr>
          </thead>
          <tbody>
            {answer.ingredients.map((i) => (
              <tr key={i.id} className={cn("border-t border-line", i.low && "text-tomato")}>
                <td className="py-1">{i.name}</td>
                <td className="py-1 text-right font-mono tabular-nums">
                  {i.onHand} {i.unit}
                  {i.onOrder > 0 && <span className="text-basil"> +{i.onOrder}</span>}
                </td>
                <td className="py-1 text-right font-mono tabular-nums">{i.reorderPoint}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {day && (
          <table className="w-full text-[13px]">
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
                  <td className={cn("py-1 text-right font-mono tabular-nums", p.capacity && p.left / p.capacity < 0.35 && "text-amber")}>
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
      <p className="text-[15px] leading-snug text-fg">{answer.say}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={1000}
        aria-label="Message to send"
        disabled={sent !== null}
        className="mt-3 w-full resize-y rounded-2xl border border-line-strong bg-surface-2 px-3 py-2 text-[14px] text-fg disabled:opacity-60"
      />
      <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
        {answer.recipients.map((r, i) => {
          const id = r.conversationId;
          return (
            <li key={`${id ?? r.name}-${i}`} className="flex items-start gap-2.5 text-[13px]">
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
                <span className="ml-2 font-mono text-[11px] text-muted">{r.handleMasked}</span>
                <span className={cn("block text-[12px]", r.reachable ? "text-muted" : "text-amber")}>{r.note}</span>
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
          className="inline-flex items-center gap-1.5 rounded-full bg-crema px-4 py-2 text-[13px] font-semibold text-ink disabled:opacity-40"
        >
          <Send className="size-3.5" aria-hidden />
          {sent !== null ? `Sent to ${sent}` : `Send to ${picked.size}`}
        </button>
        <span className="text-[12px] text-muted">Each text is logged in that customer&apos;s thread.</span>
      </div>
    </div>
  );
}
