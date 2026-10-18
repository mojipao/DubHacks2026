"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: [string, string][] = [
  ["A", "Approve the focused ticket (and its linked reorder)"],
  ["E", "Edit the focused reply"],
  ["R", "Reject (86) the focused ticket"],
  ["Enter", "Open the ticket's trace and evidence"],
  ["J / K", "Next / previous ticket"],
  ["S", "Phone simulator"],
  ["?", "This help"],
];

export function ShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[28px] border-line bg-white text-fg sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard at the pass</DialogTitle>
          <DialogDescription className="text-muted">Nothing leaves the kitchen until you call it.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5">
          {SHORTCUTS.map(([key, what]) => (
            <div key={key} className="contents">
              <dt>
                <kbd className="inline-flex min-w-8 justify-center rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[12px] text-fg shadow-[0_2px_0_var(--line-strong)]">
                  {key}
                </kbd>
              </dt>
              <dd className="text-[14px] text-fg/85">{what}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
