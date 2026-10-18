"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/data/store";
import { cn } from "@/lib/utils";

const AGENTS = [
  { key: "intake", label: "Intake" },
  { key: "ops", label: "Ops" },
  { key: "guard", label: "Guard" },
] as const;

export function AgentStatus() {
  const { state } = useStore();

  const statuses = useMemo(() => {
    const now = Date.parse(state.now);
    return AGENTS.map((agent) => {
      const recent = state.events.find((e) => {
        if (e.type !== "agent.step") return false;
        const a = String(e.data.agent ?? "");
        return a === agent.key || e.actor === `agent:${agent.key}`;
      });
      const age = recent ? now - Date.parse(recent.at) : Infinity;
      const failed = recent && String(recent.data.error ?? "");
      let tone: "basil" | "amber" | "tomato" = "basil";
      if (failed) tone = "tomato";
      else if (age < 5000) tone = "amber";
      return { ...agent, tone, pulse: tone === "amber" };
    });
  }, [state.events, state.now]);

  return (
    <div className="flex items-center gap-3">
      {statuses.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5 text-[13px] text-fg/90">
          <span
            className={cn(
              "size-2 rounded-full",
              s.tone === "basil" && "bg-basil",
              s.tone === "amber" && "bg-amber",
              s.tone === "tomato" && "bg-tomato",
              s.pulse && "animate-pulse",
            )}
          />
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}
