/**
 * Material 3 checkbox.
 *
 * A real <input type="checkbox">, visually hidden, with the M3 box drawn in
 * front of it. Native rather than a div with a role, for the same reason
 * Select wraps a native <select>: keyboard behaviour, form participation and
 * screen-reader support all come free, and none of them are easy to rebuild
 * correctly.
 *
 * The whole control is a <label>, so the text is part of the hit target. M3
 * asks for a 48px touch target and an 18px box on its own is nowhere near it.
 *
 * Two things to know before editing the classes:
 *
 *  - `peer-*` compiles to a *sibling* selector, so it only reaches elements
 *    that come after the input at the same level. The tick is nested inside
 *    the box, so the box carries `peer-checked:[&>svg]:scale-100` rather than
 *    the tick carrying `peer-checked:scale-100`, which would silently never
 *    match.
 *  - Two peer variants cannot be chained. `peer-checked:peer-hover:` does not
 *    mean "checked and hovered", it produces a selector that matches nothing,
 *    so the state layer stays one neutral colour in both states.
 */

import type { InputHTMLAttributes } from "react";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  id: string;
  label: string;
  /** Helper text under the row. */
  supportingText?: string;
}

export function Checkbox({
  id,
  label,
  supportingText,
  className = "",
  ...props
}: CheckboxProps) {
  const describedBy = supportingText ? `${id}-supporting` : undefined;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={[
          "flex cursor-pointer items-center gap-2 text-on-surface",
          "has-[:disabled]:cursor-not-allowed has-[:disabled]:text-on-surface/38",
        ].join(" ")}
      >
        <span className="relative flex size-12 shrink-0 items-center justify-center">
          <input
            id={id}
            type="checkbox"
            aria-describedby={describedBy}
            className="peer absolute size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            {...props}
          />

          {/* M3 draws the state layer on a 40px circle around the box, not on
              the box itself. */}
          <span
            aria-hidden
            className={[
              "pointer-events-none absolute size-10 rounded-full bg-transparent",
              "transition-colors duration-[--md-sys-motion-duration-short] ease-standard",
              "peer-hover:bg-on-surface/8 peer-focus-visible:bg-on-surface/12",
            ].join(" ")}
          />

          <span
            aria-hidden
            className={[
              "pointer-events-none relative flex size-[18px] items-center justify-center",
              "rounded-[2px] border-2 border-on-surface-variant",
              "transition-colors duration-[--md-sys-motion-duration-short] ease-standard",
              "peer-checked:border-primary peer-checked:bg-primary",
              "peer-checked:[&>svg]:scale-100",
              "peer-disabled:border-on-surface/38",
              "peer-checked:peer-disabled:bg-on-surface/38",
            ].join(" ")}
          >
            {/* Drawn rather than imported, so it scales with the box and costs
                no icon. Scaled to nothing until the input is checked. */}
            <svg
              viewBox="0 0 18 18"
              className="size-[18px] scale-0 text-on-primary transition-transform duration-[--md-sys-motion-duration-short] ease-standard"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 9.2 7.2 12.4 14 5.6" />
            </svg>
          </span>
        </span>

        <span className="text-body-large">{label}</span>
      </label>

      {supportingText ? (
        <p id={describedBy} className="ml-12 text-body-small text-on-surface-variant">
          {supportingText}
        </p>
      ) : null}
    </div>
  );
}
