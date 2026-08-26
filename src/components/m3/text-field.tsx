/**
 * Material 3 outlined text field.
 *
 * The label sits inside the field when it is empty and floats up into a gap in
 * the outline once the field has focus or content. M3 does that with a notched
 * outline; this does it with a label that translates upward and paints a strip
 * of the field's own background behind itself to hide the border underneath.
 * Same result, far less code, and it survives the field being resized.
 *
 * The notch colour comes from the --m3-field-surface variable that container
 * components such as Card set, so the strip always matches its backdrop.
 *
 * `peer` and `peer-focus:` are how the label reacts to the input's state
 * without any JavaScript. The `placeholder=" "` on the input is not a mistake:
 * a single space makes `:placeholder-shown` true only while the field is
 * genuinely empty, which is what tells the label whether to sit down or float.
 */

import type { InputHTMLAttributes } from "react";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  /** Helper text under the field. Becomes the error message when `error` is set. */
  supportingText?: string;
  error?: boolean;
}

export function TextField({
  id,
  label,
  supportingText,
  error = false,
  className = "",
  ...props
}: TextFieldProps) {
  const describedBy = supportingText ? `${id}-supporting` : undefined;

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <input
          id={id}
          placeholder=" "
          aria-invalid={error || undefined}
          aria-describedby={describedBy}
          className={[
            "peer h-14 w-full rounded-xs border px-4",
            "bg-transparent text-body-large text-on-surface",
            "transition-[border-color,border-width] duration-[--md-sys-motion-duration-short] ease-standard",
            "focus:outline-none focus:border-2",
            "placeholder:text-transparent",
            "disabled:cursor-not-allowed disabled:border-on-surface/12 disabled:text-on-surface/38",
            error
              ? "border-error focus:border-error"
              : "border-outline focus:border-primary hover:border-on-surface",
          ].join(" ")}
          {...props}
        />
        <label
          htmlFor={id}
          className={[
            "pointer-events-none absolute left-4 origin-left px-1",
            // Floating position: sitting on the outline itself.
            "-top-2 text-body-small",
            // Backdrop that notches the outline once the label floats.
            // Colour and state handling live in globals.css.
            "m3-field-label",
            "transition-all duration-[--md-sys-motion-duration-short] ease-standard",
            // Resting position: vertically centred inside an empty field.
            "peer-placeholder-shown:top-4 peer-placeholder-shown:text-body-large",
            // Back up on focus, even while still empty.
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
