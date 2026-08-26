/**
 * Material 3 outlined select.
 *
 * A native <select> under M3 outlined-field styling. Native rather than a
 * custom listbox on purpose: it gets keyboard support, screen-reader support
 * and the platform's own picker on mobile for free, and a hand-rolled dropdown
 * would be a lot of code to arrive somewhere worse.
 *
 * The label always floats. Unlike a text field, a select is never visually
 * empty -- it always shows either a chosen option or a placeholder -- so there
 * is no resting state to sit down into.
 */

import type { SelectHTMLAttributes } from "react";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  id: string;
  label: string;
  supportingText?: string;
  error?: boolean;
}

export function Select({
  id,
  label,
  supportingText,
  error = false,
  className = "",
  children,
  ...props
}: SelectProps) {
  const describedBy = supportingText ? `${id}-supporting` : undefined;

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error || undefined}
          aria-describedby={describedBy}
          className={[
            "peer h-14 w-full appearance-none rounded-xs border px-4 pr-10",
            "bg-transparent text-body-large text-on-surface",
            "transition-[border-color,border-width] duration-[--md-sys-motion-duration-short] ease-standard",
            "focus:border-2 focus:outline-none",
            "disabled:cursor-not-allowed disabled:border-on-surface/12 disabled:text-on-surface/38",
            error
              ? "border-error focus:border-error"
              : "border-outline hover:border-on-surface focus:border-primary",
          ].join(" ")}
          {...props}
        >
          {children}
        </select>

        <label
          htmlFor={id}
          className={[
            "pointer-events-none absolute left-4 -top-2 origin-left px-1",
            "text-body-small m3-field-label",
            error ? "text-error" : "text-on-surface-variant peer-focus:text-primary",
          ].join(" ")}
        >
          {label}
        </label>

        {/* The native arrow is hidden by appearance-none, so draw M3's. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-on-surface-variant"
        >
          <svg viewBox="0 -960 960 960" fill="currentColor" className="size-6">
            <path d="M480-360 280-560h400L480-360Z" />
          </svg>
        </span>
      </div>

      {supportingText ? (
        <p
          id={describedBy}
          className={[
            "mt-1 px-4 text-body-small",
            error ? "text-error" : "text-on-surface-variant",
          ].join(" ")}
        >
          {supportingText}
        </p>
      ) : null}
    </div>
  );
}
