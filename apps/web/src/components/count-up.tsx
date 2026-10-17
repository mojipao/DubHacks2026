"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** A number that counts to its new value and glows briefly when it goes up. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const [bumped, setBumped] = useState(false);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value) return;
    if (reduce) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(value);
      return;
    }
    if (value > start) setBumped(true);
    const controls = animate(start, value, {
      duration: Math.min(1.2, 0.35 + Math.abs(value - start) * 0.05),
      ease: "easeOut",
      onUpdate: (v) => setShown(Math.round(v)),
    });
    const t = setTimeout(() => setBumped(false), 1400);
    return () => {
      controls.stop();
      clearTimeout(t);
    };
  }, [value, reduce]);

  return (
    <span
      className={cn(
        "inline-block rounded px-0.5 tabular-nums transition-[color,background-color] duration-700",
        bumped && "bg-amber/20 text-amber",
        className,
      )}
    >
      {shown}
    </span>
  );
}
