"use client";

import { motion, useReducedMotion } from "motion/react";
import { Smartphone } from "lucide-react";
import { GlowButton } from "@/components/glow-button";

/** Empty rail: three blank tickets swaying on their clips, waiting for the first text. */
export function EmptyPass({ onOpenSim }: { onOpenSim: () => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="relative mb-8 flex gap-5" aria-hidden>
        {[-2.5, 1.5, -1].map((rot, i) => (
          <motion.div
            key={i}
            className="relative w-24 origin-top"
            initial={false}
            animate={reduce ? { rotate: rot } : { rotate: [rot, -rot, rot] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="mx-auto mb-[-3px] h-2.5 w-6 rounded-sm bg-[#5b524b]" />
            <div className="ticket-paper h-28 rounded-[5px] opacity-[0.16] shadow-[0_10px_24px_rgba(0,0,0,0.4)]">
              <div className="ticket-perforation h-2" />
              <div className="mx-3 mt-3 space-y-2">
                <div className="h-1.5 w-3/4 rounded bg-ink/60" />
                <div className="h-1.5 w-1/2 rounded bg-ink/40" />
                <div className="h-1.5 w-2/3 rounded bg-ink/40" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <p className="max-w-sm text-[17px] font-semibold text-fg">Quiet at the pass.</p>
      <p className="mt-1 max-w-sm text-[14px] text-muted">
        Text the shop to see the agents work. Every reply waits here for your call.
      </p>
      <GlowButton tone="sky" className="mt-6" onClick={onOpenSim}>
        <Smartphone className="size-4" />
        Open phone simulator
      </GlowButton>
    </div>
  );
}
