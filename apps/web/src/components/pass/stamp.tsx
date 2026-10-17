"use client";

import { motion, useReducedMotion } from "motion/react";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stamp({
  kind,
  viaText,
  delay = 0,
}: {
  kind: "sent" | "rejected" | "text";
  viaText?: boolean;
  /** Seconds; a linked child stamps just after its parent. */
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const label =
    kind === "sent" ? "SENT" : kind === "rejected" ? "86'd" : "APPROVED BY TEXT";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 1.8, rotate: -16 }}
      animate={{ opacity: 1, scale: 1, rotate: -9 }}
      transition={{ type: "spring", stiffness: 420, damping: 18, mass: 0.6, delay }}
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-[3px] border-[4px] bg-ticket/85 px-3 py-1.5 font-mono leading-none font-black tracking-[0.2em] whitespace-nowrap shadow-[0_0_0_3px_rgba(245,239,228,0.7)]",
        kind === "text" ? "text-[17px]" : "text-[26px]",
        kind === "sent" && "border-[#2f7d47] text-[#2f7d47]",
        kind === "rejected" && "border-[#b8401f] text-[#b8401f]",
        kind === "text" && "border-[#2c6aa3] text-[#2c6aa3]",
      )}
    >
      {(kind === "text" || viaText) && <Phone className="size-5" />}
      {label}
    </motion.div>
  );
}
