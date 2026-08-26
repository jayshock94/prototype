/**
 * Material 3 assist chip.
 *
 * A suggestion the person can take or ignore -- not a command, and not a
 * filter. M3 draws these as a 32px outlined pill with label-large text, and
 * they carry a state layer like any other interactive surface.
 *
 * Deliberately not a Button: a chip is a lighter-weight offer, and using the
 * button styling here would give a suggestion the same visual weight as
 * "Create prototype".
 */

import type { ButtonHTMLAttributes } from "react";

export function AssistChip({
  className = "",
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={[
        "m3-state-layer inline-flex h-8 items-center rounded-sm border border-outline px-3",
        "text-label-large text-on-surface text-left",
        "transition-colors duration-[--md-sys-motion-duration-short] ease-standard",
        "hover:border-on-surface",
        "disabled:pointer-events-none disabled:border-on-surface/12 disabled:text-on-surface/38",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
