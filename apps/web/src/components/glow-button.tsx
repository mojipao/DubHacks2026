"use client";

import type { ComponentProps, CSSProperties } from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const TONES = {
  amber: "var(--amber)",
  basil: "var(--basil)",
  tomato: "var(--tomato)",
  sky: "var(--sky)",
} as const;

export type GlowTone = keyof typeof TONES;

/**
 * Frosted glass pill with a colored glow on hover and focus. For dark surfaces only;
 * on ticket paper use the ink buttons instead. `asChild` renders a Link or <a> as the face.
 */
export function GlowButton({
  tone = "amber",
  size = "md",
  block = false,
  asChild = false,
  className,
  disabled,
  children,
  ...props
}: ComponentProps<"button"> & {
  tone?: GlowTone;
  size?: "sm" | "md" | "lg";
  /** Full width of its container (menus, mobile forms). */
  block?: boolean;
  asChild?: boolean;
}) {
  const Face = asChild ? Slot.Root : "button";
  return (
    <span
      className={cn("glow-btn", className)}
      data-size={size}
      data-block={block || undefined}
      data-disabled={disabled || undefined}
      style={{ "--glow": TONES[tone] } as CSSProperties}
    >
      <Face className="glow-btn__face" disabled={asChild ? undefined : disabled} {...props}>
        {children}
      </Face>
    </span>
  );
}
