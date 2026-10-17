import { flagMeta } from "@/lib/flags";
import { cn } from "@/lib/utils";

export function RiskChip({ flag }: { flag: string }) {
  const meta = flagMeta(flag);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        meta.tone === "tomato" && "bg-[color-mix(in_srgb,var(--tomato)_18%,transparent)] text-[#9a2f12]",
        meta.tone === "amber" && "bg-[color-mix(in_srgb,var(--amber)_22%,transparent)] text-[#7a4a0a]",
        meta.tone === "muted" && "bg-black/5 text-ink/70",
      )}
    >
      {meta.label}
    </span>
  );
}
