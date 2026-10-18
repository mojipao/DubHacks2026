"use client";

import Link from "next/link";
import { Coffee, Keyboard, MoreHorizontal, QrCode, ScrollText, Smartphone, Sunrise, Truck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { GlowButton } from "@/components/glow-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BRAND_SHORT } from "@/lib/business";
import { useStore } from "@/lib/data/store";
import { cn } from "@/lib/utils";

export function TopBar({
  onOpenSim,
  onOpenKeys,
  tabs,
}: {
  onOpenSim: () => void;
  onOpenKeys: () => void;
  /** The view switcher, rendered in the same row so the header stays one line. */
  tabs: React.ReactNode;
}) {
  const { state, mode, winbackScan, receiveDelivery } = useStore();

  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cherry text-white">
          <Coffee className="size-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 leading-tight">
          <span className="heading block truncate text-[22px] text-fg">{BRAND_SHORT}</span>
          <span className="block text-[12px] font-semibold tracking-[0.14em] text-crema uppercase">
            Back of House
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1">{tabs}</div>

      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-[13px] font-semibold tracking-wide uppercase",
            state.connection === "polling" ? "text-amber" : "text-basil",
          )}
          title={mode === "live" ? "Live data from the shop" : "Scripted demo data"}
        >
          <span className="relative flex size-1.5">
            {state.connection !== "polling" && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
            )}
            <span className="relative inline-flex size-1.5 rounded-full bg-current" />
          </span>
          {state.connection === "mock" ? "Demo" : state.connection === "realtime" ? "Live" : "Reconnecting"}
        </span>

        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenSim}
          className="rounded-full px-3 text-[13px] font-semibold text-fg hover:bg-surface-2"
          title="Phone simulator (S)"
        >
          <Smartphone className="size-4" />
          <span className="hidden sm:inline">Sim</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenKeys}
          className="rounded-full px-3 text-[13px] font-semibold text-fg hover:bg-surface-2"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="size-4" />
          <span className="hidden sm:inline">Keys</span>
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More" className="rounded-full text-muted hover:bg-surface-2 hover:text-fg">
              <MoreHorizontal className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[24px] border-line bg-surface text-fg">
            <DialogHeader>
              <DialogTitle>Control room</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 pt-1">
              <GlowButton block tone="sky" onClick={onOpenSim}>
                <Smartphone className="size-4" />
                Phone simulator
              </GlowButton>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <GlowButton block tone="cherry" asChild>
                  <Link href="/join/qr">
                    <QrCode className="size-4" />
                    Join QR
                  </Link>
                </GlowButton>
                <GlowButton block tone="cherry" asChild>
                  <Link href="/join">
                    <UserPlus className="size-4" />
                    Join page
                  </Link>
                </GlowButton>
              </div>
              <GlowButton block tone="basil" asChild>
                <Link href="/audit">
                  <ScrollText className="size-4" />
                  Audit log
                </Link>
              </GlowButton>
              <div className="eyebrow mt-2 border-t border-line pt-4">Demo controls</div>
              <GlowButton
                block
                tone="cherry"
                onClick={() =>
                  void winbackScan()
                    .then((n) => toast.message(n > 0 ? `Morning scan drafted ${n} win-back${n === 1 ? "" : "s"}` : "Morning scan: no lapsed regulars"))
                    .catch((e: Error) => toast.error(e.message))
                }
              >
                <Sunrise className="size-4" />
                Morning scan
              </GlowButton>
              <GlowButton
                block
                tone="sky"
                onClick={() =>
                  void receiveDelivery()
                    .then(() => toast.success("Supplier delivery received"))
                    .catch((e: Error) => toast.error(e.message))
                }
              >
                <Truck className="size-4" />
                Receive delivery (simulated)
              </GlowButton>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
