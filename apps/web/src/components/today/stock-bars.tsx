"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useStore } from "@/lib/data/store";
import { cn } from "@/lib/utils";

const COLLAPSED = 6;

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 2 : 1).replace(/0+$/, "").replace(/\.$/, "");
}

/** Ingredients whose on-hand or on-order just changed, so their row can flash. */
function useChanged(ingredients: { id: string; onHand: number; onOrder: number }[]) {
  const prev = useRef(new Map<string, string>());
  const [changed, setChanged] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const hits: string[] = [];
    for (const i of ingredients) {
      const sig = `${i.onHand}|${i.onOrder}`;
      const before = prev.current.get(i.id);
      if (before !== undefined && before !== sig) hits.push(i.id);
      prev.current.set(i.id, sig);
    }
    if (hits.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChanged(new Set(hits));
    const t = setTimeout(() => setChanged(new Set()), 1800);
    return () => clearTimeout(t);
  }, [ingredients]);
  return changed;
}

export function StockBars() {
  const { state } = useStore();
  const reduce = useReducedMotion();
  const [showAll, setShowAll] = useState(false);
  const changed = useChanged(state.ingredients);

  // Tightest first: the ingredients closest to (or under) their reorder point, plus anything that just moved.
  const sorted = useMemo(
    () =>
      [...state.ingredients].sort((a, b) => {
        const ra = (a.onHand + a.onOrder) / Math.max(a.reorderPoint, 0.001);
        const rb = (b.onHand + b.onOrder) / Math.max(b.reorderPoint, 0.001);
        return ra - rb;
      }),
    [state.ingredients],
  );
  const visible = showAll
    ? sorted
    : sorted.filter((ing, i) => i < COLLAPSED || changed.has(ing.id) || ing.onOrder > 0);

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-mono text-[12px] tracking-[0.16em] text-muted uppercase">Stock</h3>
        <span className="flex items-center gap-2 font-mono text-[10px] text-muted">
          <span className="inline-block h-2 w-3 rounded-[1px] bg-basil" /> on hand
          <span className="stock-hatch inline-block h-2 w-3 rounded-[1px]" /> on order
        </span>
      </div>
      <ul className="space-y-2.5">
        {visible.map((ing) => {
          const max = Math.max(ing.onHand + ing.onOrder, ing.reorderPoint * 2, 0.001);
          const handPct = Math.min(100, (ing.onHand / max) * 100);
          const orderPct = Math.min(100 - handPct, (ing.onOrder / max) * 100);
          const reorderPct = Math.min(100, (ing.reorderPoint / max) * 100);
          const low = ing.onHand <= ing.reorderPoint;
          return (
            <motion.li
              key={ing.id}
              layout={!reduce}
              className={cn(
                "-mx-1.5 rounded px-1.5 py-0.5 transition-colors duration-700",
                changed.has(ing.id) && "bg-amber/10",
              )}
            >
              <div className="mb-1 flex justify-between gap-2 text-[13px]">
                <span className={cn("truncate", low ? "font-semibold text-tomato" : "text-fg")}>
                  {ing.name}
                  {low && <span className="ml-1.5 text-[10px] tracking-wide uppercase">low</span>}
                </span>
                <span className="shrink-0 font-mono text-[12px] text-muted tabular-nums">
                  {fmt(ing.onHand)}
                  {ing.onOrder > 0 && <span className="text-amber"> +{fmt(ing.onOrder)}</span>} {ing.unit}
                </span>
              </div>
              <div className="relative flex h-2.5 overflow-hidden rounded-sm bg-line/80">
                <motion.div
                  className={cn("h-full", low ? "bg-tomato" : "bg-basil")}
                  initial={false}
                  animate={{ width: `${handPct}%` }}
                  transition={{ type: "spring", stiffness: 160, damping: 22 }}
                />
                <motion.div
                  className="stock-hatch h-full"
                  initial={false}
                  animate={{ width: `${orderPct}%` }}
                  transition={{ type: "spring", stiffness: 160, damping: 22 }}
                />
                {/* Reorder point tick */}
                <span
                  className="absolute top-0 h-full w-px bg-fg/60"
                  style={{ left: `${reorderPct}%` }}
                  aria-hidden
                />
              </div>
            </motion.li>
          );
        })}
      </ul>
      {sorted.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 font-mono text-[11px] text-muted hover:text-fg"
        >
          {showAll ? "Show fewer" : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}
