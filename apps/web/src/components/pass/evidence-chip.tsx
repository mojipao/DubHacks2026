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
        "max-w-full truncate rounded-[4px] border border-ink/10 bg-white/50 px-1.5 py-0.5 text-left text-[12px] text-ink/80",
        onClick && "hover:border-ink/30 hover:bg-white/80",
      )}
    >
      <span className="font-semibold text-ink">{label}:</span> {value}
    </button>
  );
}
