"use client";

import type { ComponentProps, CSSProperties } from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

// Bright lamp colors: these glow against a black pill, so they're lighter than the text-safe status tokens.
const TONES = {
  cherry: "#ff4a3d",
  amber: "#ffb53d",
  basil: "#3ee07f",
  tomato: "#ff5a36",
  sky: "#3b9bff",
} as const;

export type GlowTone = keyof typeof TONES;

/**
 * Glass pill with colored glow lamps on hover and focus. `asChild` renders a Link or <a> as the face.
 */
export function GlowButton({
  tone = "cherry",
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
