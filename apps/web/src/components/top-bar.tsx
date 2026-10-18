"use client";

import Link from "next/link";
import { Keyboard, MoreHorizontal, QrCode, ScrollText, Smartphone, Sunrise, Truck, UserPlus } from "lucide-react";
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
  tabs: React.ReactNode;
}) {
  const { state, mode, winbackScan, receiveDelivery } = useStore();

  return (
    <header className="flex flex-wrap items-center gap-x-8 gap-y-3 px-2 py-4 md:px-4">
      <div className="min-w-0 leading-tight">
        <span className="heading block truncate text-[26px] text-fg md:text-[28px]">{BRAND_SHORT}</span>
        <span className="mt-0.5 block text-[11px] font-medium tracking-[0.2em] text-crema uppercase">
          Back of House
        </span>
      </div>

      <div className="min-w-0 flex-1">{tabs}</div>

      <div className="flex items-center gap-1">
        <span
          className={cn(
            "mr-2 inline-flex items-center gap-1.5 text-[12px] font-medium tracking-[0.12em] uppercase",
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
          className="rounded-none px-3 text-[13px] font-medium text-fg/85 hover:bg-transparent hover:text-fg"
          title="Phone simulator (S)"
        >
          <Smartphone className="size-4" />
          <span className="hidden sm:inline">Sim</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenKeys}
          className="rounded-none px-3 text-[13px] font-medium text-fg/85 hover:bg-transparent hover:text-fg"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="size-4" />
          <span className="hidden sm:inline">Keys</span>
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="More"
              className="rounded-none text-muted hover:bg-transparent hover:text-fg"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[20px] border-line/60 bg-surface-2 text-fg">
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-heading)] text-2xl font-semibold">
                Control room
              </DialogTitle>
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
                    .then((n) =>
                      toast.message(
                        n > 0
                          ? `Morning scan drafted ${n} win-back${n === 1 ? "" : "s"}`
                          : "Morning scan: no lapsed regulars",
                      ),
                    )
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
