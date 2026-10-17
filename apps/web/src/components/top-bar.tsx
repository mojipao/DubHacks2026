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
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel/80 px-4 py-2.5 backdrop-blur">
      <div className="flex min-w-0 items-center gap-4">
        <div>
          <div className="truncate text-[15px] font-semibold tracking-wide text-fg">
            {BUSINESS.name}{" "}
            <span className="font-normal text-muted">· Back of House</span>
          </div>
        </div>
        <AgentStatus />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="rounded bg-amber/15 px-2 py-0.5 font-mono text-amber">
          {pending} pending
        </span>
        <span className="font-mono text-fg">{money(paidToday)} today</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-mono text-[12px]",
            state.connection === "realtime" || state.connection === "mock"
              ? "text-basil"
              : "text-amber",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              state.connection === "polling" ? "bg-amber" : "bg-basil",
            )}
          />
          {state.connection === "mock"
            ? "mock"
            : state.connection === "realtime"
              ? "live"
              : "polling"}
          {mode === "live" ? "" : " · fixtures"}
        </span>
        <span className="font-mono text-muted">{localClock(new Date(state.now))}</span>

        <Dialog>
          <DialogTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More">
              <MoreHorizontal className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="border-line bg-panel text-fg">
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
