"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/data/store";
import type { UiIngredient } from "@/lib/data/types";
import { useFlash } from "@/lib/use-flash";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 2 : 1).replace(/0+$/, "").replace(/\.$/, "");
}

function StockLine({ ing, flashing }: { ing: UiIngredient; flashing: boolean }) {
  const max = Math.max(ing.onHand + ing.onOrder, ing.reorderPoint * 2, 0.001);
  const handPct = Math.min(100, (ing.onHand / max) * 100);
  const orderPct = Math.min(100 - handPct, (ing.onOrder / max) * 100);
  const low = ing.onHand <= ing.reorderPoint;
  return (
    <li className={cn("py-3 transition-colors duration-700", flashing && "bg-[color-mix(in_srgb,var(--qishr)_10%,transparent)]")}>
      <div className="flex items-baseline justify-between gap-3 text-[15px]">
        <span className={cn("truncate font-semibold", low ? "text-qamar" : "text-ink")}>{ing.name}</span>
        <span className="shrink-0 text-[14px] text-muted tabular">
          {fmt(ing.onHand)} {ing.unit} left
          {ing.onOrder > 0 && <span className="text-qishr-ink"> · {fmt(ing.onOrder)} {ing.unit} on order</span>}
        </span>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className={cn("h-full transition-[width] duration-500 ease-out", low ? "bg-qamar" : "bg-[#9c8470]")} style={{ width: `${handPct}%` }} />
        <div className="stock-hatch h-full transition-[width] duration-500 ease-out" style={{ width: `${orderPct}%` }} />
      </div>
    </li>
  );
}

/** Only what needs the owner: low stock and anything on order. The rest is one line. */
export function StockBars() {
  const { state } = useStore();
  const [showAll, setShowAll] = useState(false);
  const flashing = useFlash(state.ingredients.map((i) => ({ id: i.id, sig: `${i.onHand}|${i.onOrder}` })));

  const sorted = useMemo(
    () =>
      [...state.ingredients].sort(
        (a, b) => (a.onHand + a.onOrder) / Math.max(a.reorderPoint, 0.001) - (b.onHand + b.onOrder) / Math.max(b.reorderPoint, 0.001),
      ),
    [state.ingredients],
  );
  const needs = sorted.filter((i) => i.onHand <= i.reorderPoint || i.onOrder > 0 || flashing.has(i.id));
  const fine = sorted.filter((i) => !needs.includes(i));

  return (
    <div>
      <h2 className="mb-3 text-[20px] font-bold text-ink">Stock</h2>
      {needs.length === 0 ? (
        <p className="border-t border-line py-4 text-[15px] text-muted">Everything is stocked.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {needs.map((i) => (
            <StockLine key={i.id} ing={i} flashing={flashing.has(i.id)} />
          ))}
        </ul>
      )}
      {fine.length > 0 && (
        <div className="border-t border-line pt-3">
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[14px] font-semibold text-brew hover:underline">
            {showAll ? "Hide the rest" : `${fine.length} other ingredients are fine. Show them`}
          </button>
          {showAll && (
            <ul className="mt-1 divide-y divide-line">
              {fine.map((i) => (
                <StockLine key={i.id} ing={i} flashing={false} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
