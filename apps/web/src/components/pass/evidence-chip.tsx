"use client";

import { cn } from "@/lib/utils";

export function EvidenceChip({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "max-w-full truncate rounded-md border border-ink/10 bg-white/60 px-2 py-0.5 text-left text-[12px] text-ink/75",
        onClick && "hover:border-ink/25 hover:bg-white",
      )}
    >
      <span className="mr-1 text-[10px] font-semibold tracking-wide text-ink/45 uppercase">{label}</span> {value}
    </button>
  );
}
