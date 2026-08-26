/**
 * Material 3 icon button -- a 40px circular tap target holding a 24px icon.
 *
 * `aria-label` is required rather than optional. An icon button has no visible
 * text, so without a label a screen reader announces nothing useful.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  children: ReactNode;
}

export function IconButton({
  className = "",
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={[
        "m3-state-layer inline-flex size-10 shrink-0 items-center justify-center",
        "rounded-full text-on-surface-variant",
        "disabled:pointer-events-none disabled:text-on-surface/38",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
