"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { Keyboard, Menu, QrCode, ScrollText, Smartphone, Sunrise, Truck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { SHOP_NAME, SHOP_NAME_AR } from "@/lib/business";
import { useStore } from "@/lib/data/store";
import { cn } from "@/lib/utils";

const ITEM =
  "flex cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-[14px] text-ink outline-none select-none data-[highlighted]:bg-surface-2";

/** The brown band: who the shop is, where you are, and the two tools a host reaches for. */
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
  const live = state.connection === "realtime";

  return (
    <header className="flex h-16 shrink-0 items-stretch gap-2 bg-shell px-3 text-shell-fg sm:gap-6 sm:px-4 md:px-8">
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
        <span className="heading hidden truncate text-[24px] leading-none sm:inline">{SHOP_NAME}</span>
        <span className="heading text-[22px] leading-none sm:hidden">{SHOP_NAME.split(" ")[0]}</span>
        <span lang="ar" dir="rtl" className="font-[family-name:var(--font-arabic)] text-[13px] leading-none text-qishr sm:text-[15px] md:text-[19px]">
          {SHOP_NAME_AR}
        </span>
      </div>

      <div className="min-w-0 flex-1">{tabs}</div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn("hidden items-center gap-2 text-[13px] sm:inline-flex", live ? "text-shell-fg/80" : "text-shell-fg/60")}
          title={mode === "live" ? "Live data from the shop" : "Scripted demo data, no server needed"}
        >
          <span className={cn("size-2 rounded-full", state.connection === "polling" ? "bg-qishr" : "bg-[#7fae86]")} />
          {state.connection === "mock" ? "Demo data" : live ? "Live" : "Reconnecting"}
        </span>

        <button
          type="button"
          onClick={onOpenSim}
          title="Text the shop as a customer (S)"
          aria-label="Phone simulator"
          className="ml-2 hidden h-9 items-center gap-2 rounded-full border border-shell-fg/25 px-3.5 text-[14px] font-semibold text-shell-fg transition-colors duration-150 hover:bg-shell-fg/10 sm:inline-flex"
        >
          <Smartphone className="size-4" />
          Phone
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            aria-label="More"
            className="inline-flex size-9 items-center justify-center rounded-full text-shell-fg/80 transition-colors duration-150 hover:bg-shell-fg/10 hover:text-shell-fg"
          >
            <Menu className="size-5" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 min-w-60 rounded-xl border border-line bg-paper p-1.5 shadow-[0_12px_32px_-12px_rgba(43,26,16,0.35)]"
            >
              <DropdownMenu.Item className={ITEM} onSelect={onOpenSim}>
                <Smartphone className="size-4 text-muted" /> Phone simulator
              </DropdownMenu.Item>
              <DropdownMenu.Item className={ITEM} asChild>
                <Link href="/join/qr">
                  <QrCode className="size-4 text-muted" /> Join QR code
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item className={ITEM} asChild>
                <Link href="/join">
                  <UserPlus className="size-4 text-muted" /> Join page
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item className={ITEM} asChild>
                <Link href="/audit">
                  <ScrollText className="size-4 text-muted" /> Audit log
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item className={ITEM} onSelect={onOpenKeys}>
                <Keyboard className="size-4 text-muted" /> Keyboard shortcuts
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1.5 h-px bg-line" />
              <DropdownMenu.Label className="px-3 pt-1 pb-1.5 text-[12px] text-muted">Demo controls</DropdownMenu.Label>
              <DropdownMenu.Item
                className={ITEM}
                onSelect={() =>
                  void winbackScan()
                    .then((n) =>
                      toast.message(n > 0 ? `Morning scan drafted ${n} win-back${n === 1 ? "" : "s"}` : "Morning scan: no lapsed regulars"),
                    )
                    .catch((e: Error) => toast.error(e.message))
                }
              >
                <Sunrise className="size-4 text-muted" /> Morning scan
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={ITEM}
                onSelect={() =>
                  void receiveDelivery()
                    .then(() => toast.success("Supplier delivery received"))
                    .catch((e: Error) => toast.error(e.message))
                }
              >
                <Truck className="size-4 text-muted" /> Receive supplier delivery
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
