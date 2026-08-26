/**
 * Material 3 small top app bar.
 *
 * 64px tall, sitting on a surface-container colour so it separates from the
 * page background without needing a shadow. M3 only adds elevation to an app
 * bar once the content beneath it has scrolled under it; that behaviour needs a
 * scroll listener and is not worth it yet.
 */

import type { ReactNode } from "react";

export interface TopAppBarProps {
  title: ReactNode;
  /** Small text above the title, for context such as a section name. */
  overline?: ReactNode;
  /** Actions pinned to the right, typically icon buttons. */
  actions?: ReactNode;
}

export function TopAppBar({ title, overline, actions }: TopAppBarProps) {
  return (
    <header className="sticky top-0 z-10 bg-surface-container text-on-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <div className="min-w-0 flex-1">
          {overline ? (
            <p className="text-label-medium text-on-surface-variant">{overline}</p>
          ) : null}
          <h1 className="truncate text-title-large">{title}</h1>
        </div>
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      </div>
    </header>
  );
}
