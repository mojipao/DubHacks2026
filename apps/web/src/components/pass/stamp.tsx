"use client";

import { motion, useReducedMotion } from "motion/react";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stamp({
  kind,
  viaText,
}: {
  kind: "sent" | "rejected" | "text";
  viaText?: boolean;
}) {
  const reduce = useReducedMotion();
  const label =
    kind === "sent" ? "SENT" : kind === "rejected" ? "86'd" : "APPROVED BY TEXT";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 1.4, rotate: -12 }}
      animate={{ opacity: 1, scale: 1, rotate: -8 }}
      transition={{ type: "spring", stiffness: 420, damping: 18, mass: 0.6 }}
      className={cn(
        "pointer-events-none absolute right-3 top-10 z-10 flex items-center gap-1 rounded-sm border-[3px] px-2 py-1 font-mono text-sm font-black tracking-[0.18em]",
        kind === "sent" && "border-basil text-basil",
        kind === "rejected" && "border-tomato text-tomato",
        kind === "text" && "border-sky text-sky",
      )}
    >
      {(kind === "text" || viaText) && <Phone className="size-3.5" />}
      {label}
    </motion.div>
  );
}
