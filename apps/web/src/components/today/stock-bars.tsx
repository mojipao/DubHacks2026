"use client";

import { motion } from "motion/react";
import { useStore } from "@/lib/data/store";

export function StockBars() {
  const { state } = useStore();

  return (
    <div className="mt-5">
      <h3 className="mb-2 font-mono text-[12px] tracking-[0.16em] text-muted uppercase">
        Stock
      </h3>
      <ul className="space-y-3">
        {state.ingredients.map((ing) => {
          const max = Math.max(
            ing.onHand + ing.onOrder,
            ing.reorderPoint * 1.5,
            1,
          );
          const handPct = Math.min(100, (ing.onHand / max) * 100);
          const orderPct = Math.min(100 - handPct, (ing.onOrder / max) * 100);
          const low = ing.onHand <= ing.reorderPoint;
          return (
            <li key={ing.id}>
              <div className="mb-1 flex justify-between text-[13px]">
                <span className={low ? "text-tomato" : "text-fg"}>{ing.name}</span>
                <span className="font-mono text-[11px] text-muted">
                  {ing.onHand}
                  {ing.onOrder > 0 ? ` +${ing.onOrder}` : ""} {ing.unit}
                </span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-sm bg-line/80">
                <motion.div
                  className="h-full bg-basil"
                  animate={{ width: `${handPct}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 24 }}
                />
                {ing.onOrder > 0 && (
                  <motion.div
                    className="stock-hatch h-full"
                    animate={{ width: `${orderPct}%` }}
                    transition={{ type: "spring", stiffness: 200, damping: 24 }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
