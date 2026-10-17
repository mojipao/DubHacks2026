import { flagMeta } from "@/lib/flags";
import { cn } from "@/lib/utils";

export function RiskChip({ flag }: { flag: string }) {
  const meta = flagMeta(flag);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        meta.tone === "tomato" && "border-[#e9b4a4] bg-[#fbe6df] text-[#9a2f12]",
        meta.tone === "amber" && "border-[#ecd29f] bg-[#fbf0d9] text-[#7a4a0a]",
        meta.tone === "muted" && "border-ink/10 bg-ink/5 text-ink/70",
      )}
    >
      {meta.label}
    </span>
  );
}
