"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: [string, string][] = [
  ["1 2 3 4 5", "Orders, Today, People, Ask, House"],
  ["A", "Approve the selected order (and its restock)"],
  ["E", "Edit the reply before approving"],
  ["W", "Write your own message instead"],
  ["R", "Skip the selected order"],
  ["J / K", "Next / previous order"],
  ["S", "Phone simulator"],
  ["?", "This list"],
];

export function ShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-line bg-paper text-ink sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="heading text-[24px]">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-muted">Nothing goes out until you approve it.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5">
          {SHORTCUTS.map(([key, what]) => (
            <div key={key} className="contents">
              <dt>
                <kbd className="inline-flex min-w-8 justify-center rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[12px] text-ink shadow-[0_2px_0_var(--line-strong)]">
                  {key}
                </kbd>
              </dt>
              <dd className="text-[14px] text-ink/85">{what}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
