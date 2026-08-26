/**
 * Material 3 outlined text area.
 *
 * Same notched-outline behaviour as TextField, but multi-line. The label
 * cannot be vertically centred here -- in a tall box it would float in the
 * middle of nothing -- so when resting it sits near the top instead.
 */

import type { TextareaHTMLAttributes } from "react";

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  id: string;
  label: string;
  supportingText?: string;
  error?: boolean;
}

export function TextArea({
  id,
  label,
  supportingText,
  error = false,
  rows = 4,
  className = "",
  ...props
}: TextAreaProps) {
  const describedBy = supportingText ? `${id}-supporting` : undefined;

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <textarea
          id={id}
          rows={rows}
          placeholder=" "
          aria-invalid={error || undefined}
          aria-describedby={describedBy}
          className={[
            "peer w-full resize-y rounded-xs border px-4 py-4",
            "bg-transparent text-body-large text-on-surface",
            "transition-[border-color,border-width] duration-[--md-sys-motion-duration-short] ease-standard",
            "focus:border-2 focus:outline-none",
            "placeholder:text-transparent",
            "disabled:cursor-not-allowed disabled:border-on-surface/12 disabled:text-on-surface/38",
            error
              ? "border-error focus:border-error"
              : "border-outline hover:border-on-surface focus:border-primary",
          ].join(" ")}
          {...props}
        />
        <label
          htmlFor={id}
          className={[
            "pointer-events-none absolute left-4 origin-left px-1",
            "-top-2 text-body-small",
            "m3-field-label",
            "transition-all duration-[--md-sys-motion-duration-short] ease-standard",
            // Resting: near the top of the box, not its centre.
            "peer-placeholder-shown:top-4 peer-placeholder-shown:text-body-large",
            "peer-focus:-top-2 peer-focus:text-body-small",
            error
              ? "text-error peer-placeholder-shown:text-on-surface-variant peer-focus:text-error"
              : "text-primary peer-placeholder-shown:text-on-surface-variant peer-focus:text-primary",
            "peer-disabled:text-on-surface/38",
          ].join(" ")}
        >
          {label}
        </label>
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
