/**
 * Material 3 button.
 *
 * The five M3 variants, in the order the spec ranks them by emphasis:
 *
 *   filled    the one important action on a screen
 *   tonal     a secondary action that still deserves weight
 *   elevated  like tonal, but needs to separate itself from a busy background
 *   outlined  a secondary action, quieter
 *   text      the lowest emphasis, for things like "cancel"
 *
 * Hover and press states come from `m3-state-layer` rather than from swapping
 * background colours -- see the state layer note in globals.css.
 *
 * `Button` renders a <button>, `ButtonLink` renders a link that looks identical.
 * Use the one that matches what actually happens: something that navigates
 * should be a link, so it can be opened in a new tab and read correctly by a
 * screen reader.
 */

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "filled" | "tonal" | "elevated" | "outlined" | "text";

const VARIANT_CLASSES: Record<Variant, string> = {
  filled: "bg-primary text-on-primary shadow-level0 hover:shadow-level1",
  tonal: "bg-secondary-container text-on-secondary-container shadow-level0 hover:shadow-level1",
  elevated: "bg-surface-container-low text-primary shadow-level1 hover:shadow-level2",
  outlined: "bg-transparent text-primary border border-outline",
  text: "bg-transparent text-primary",
};

/** Shared between the button and the link so the two cannot drift apart. */
function buttonClasses({
  variant,
  fullWidth,
  hasIcon,
  className,
}: {
  variant: Variant;
  fullWidth: boolean;
  hasIcon: boolean;
  className: string;
}) {
  return [
    // M3 buttons are 40px tall, fully rounded, with 24px of side padding
    // (16px when there is a leading icon).
    "m3-state-layer inline-flex h-10 items-center justify-center gap-2 rounded-full",
    hasIcon ? "pr-6 pl-4" : "px-6",
    "text-label-large whitespace-nowrap",
    "transition-shadow duration-[--md-sys-motion-duration-short] ease-standard",
    // M3 disabled styling: the on-surface colour at 38%, background at 12%.
    "disabled:pointer-events-none disabled:cursor-not-allowed",
    "disabled:bg-on-surface/12 disabled:text-on-surface/38 disabled:shadow-level0 disabled:border-transparent",
    VARIANT_CLASSES[variant],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Stretch to the width of the container. */
  fullWidth?: boolean;
  /** Leading icon, expected to be an 18px SVG. */
  icon?: ReactNode;
}

export function Button({
  variant = "filled",
  fullWidth = false,
  icon,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, fullWidth, hasIcon: Boolean(icon), className })}
      {...props}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </button>
  );
}

export interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variant?: Variant;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export function ButtonLink({
  href,
  variant = "filled",
  fullWidth = false,
  icon,
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={buttonClasses({ variant, fullWidth, hasIcon: Boolean(icon), className })}
      {...props}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </Link>
  );
}
