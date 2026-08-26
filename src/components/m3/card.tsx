/**
 * Material 3 card.
 *
 *   elevated  lifted off the background with a shadow
 *   filled    a tinted surface, no shadow -- the quietest of the three
 *   outlined  a hairline border, for when cards sit in a list and shadows
 *             would create visual noise
 *
 * Cards are containers, not buttons. If a whole card is clickable, wrap it in a
 * link and add `m3-state-layer` so it reacts to hover like other M3 surfaces.
 */

import type { CSSProperties, HTMLAttributes } from "react";

type Variant = "elevated" | "filled" | "outlined";

const VARIANT_CLASSES: Record<Variant, string> = {
  elevated: "bg-surface-container-low text-on-surface shadow-level1",
  filled: "bg-surface-container-highest text-on-surface shadow-level0",
  outlined: "bg-surface text-on-surface border border-outline-variant shadow-level0",
};

/*
 * Each variant also announces its own background colour, so anything inside
 * the card that needs to blend into it can read the variable rather than
 * guessing. A text field uses this to colour the notch its floating label
 * paints over the outline -- see .m3-field-label in globals.css.
 */
const VARIANT_SURFACE: Record<Variant, string> = {
  elevated: "var(--md-sys-color-surface-container-low)",
  filled: "var(--md-sys-color-surface-container-highest)",
  outlined: "var(--md-sys-color-surface)",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

export function Card({
  variant = "elevated",
  className = "",
  children,
  style,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-md ${VARIANT_CLASSES[variant]} ${className}`}
      style={
        {
          "--m3-field-surface": VARIANT_SURFACE[variant],
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      {children}
    </div>
  );
}
