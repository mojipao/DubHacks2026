"use client";

import Link from "next/link";
import { MoreHorizontal, QrCode, Sunrise, Truck } from "lucide-react";
import { toast } from "sonner";
import { AgentStatus } from "@/components/agent-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BUSINESS } from "@/lib/business";
import { useStore } from "@/lib/data/store";
import { localClock, localDateKey, money } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TopBar({ onOpenSim }: { onOpenSim: () => void }) {
  const { state, mode, winbackScan, receiveDelivery } = useStore();
  const pending = state.proposals.filter((p) => p.status === "pending").length;
  const today = localDateKey(state.now);
  const paidToday = state.orders
    .filter((o) => o.paidAt && localDateKey(o.paidAt) === today)
    .reduce((sum, o) => sum + o.totalCents - o.discountCents, 0);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3 pb-2.5">
      <div className="flex min-w-0 items-center gap-5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-serif text-[26px] leading-none tracking-tight text-fg">
            {BUSINESS.name.split("&").map((part, i) => (
              <span key={i}>
                {i > 0 && <span className="text-amber italic">&amp;</span>}
                {part}
              </span>
            ))}
          </span>
          <span className="rounded-full border border-line-strong px-2 py-0.5 font-mono text-[10px] tracking-[0.16em] text-muted uppercase">
            Back of House
          </span>
        </div>
        <AgentStatus />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber px-2.5 py-1 font-mono text-[12px] font-semibold text-ink">
          <span className="tabular-nums">{pending}</span> pending
        </span>
        <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[12px] text-fg">
          <span className="tabular-nums">{money(paidToday)}</span> <span className="text-muted">paid today</span>
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[12px]",
            state.connection === "polling" ? "text-amber" : "text-basil",
          )}
          title={mode === "live" ? "Supabase realtime" : "Scripted demo data"}
        >
          <span className="relative flex size-1.5">
            {state.connection !== "polling" && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
            )}
            <span className="relative inline-flex size-1.5 rounded-full bg-current" />
          </span>
          {state.connection === "mock" ? "demo data" : state.connection === "realtime" ? "live" : "polling"}
        </span>
        <span className="px-1 font-mono text-[12px] text-muted tabular-nums">{localClock(new Date(state.now))}</span>

        <Dialog>
          <DialogTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More" className="rounded-full text-muted hover:bg-surface-2 hover:text-fg">
              <MoreHorizontal className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="border-line bg-surface text-fg">
            <DialogHeader>
              <DialogTitle>Control room</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={onOpenSim}>
                Phone simulator
              </Button>
              <Button variant="outline" asChild>
                <Link href="/join/qr">
                  <QrCode className="size-4" />
                  Join QR
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/audit">Audit log</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/join">Judge join page</Link>
              </Button>
              <div className="mt-2 border-t border-line pt-3 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
                Demo controls
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  void winbackScan()
                    .then((n) => toast.message(n > 0 ? `Morning scan drafted ${n} win-back${n === 1 ? "" : "s"}` : "Morning scan: no lapsed regulars"))
                    .catch((e: Error) => toast.error(e.message))
                }
              >
                <Sunrise className="size-4" />
                Morning scan
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  void receiveDelivery()
                    .then(() => toast.success("Supplier delivery received"))
                    .catch((e: Error) => toast.error(e.message))
                }
              >
                <Truck className="size-4" />
                Receive supplier delivery (simulated)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
