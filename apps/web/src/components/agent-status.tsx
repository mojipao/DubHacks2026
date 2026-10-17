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
    <div className="hidden items-center gap-0.5 rounded-full border border-line bg-bg/60 p-0.5 md:flex">
      {statuses.map((s) => (
        <div
          key={s.key}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-fg/80 transition-colors",
            s.pulse && "bg-amber/10 text-amber",
          )}
          title={s.tone === "amber" ? `${s.label} is working` : s.tone === "tomato" ? `${s.label} hit an error` : `${s.label} idle`}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
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
