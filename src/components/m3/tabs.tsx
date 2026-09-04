"use client";

/**
 * Material 3 primary tabs.
 *
 * Links, not buttons, because each tab is a different page. That is not a
 * detail: a link can be opened in a new tab, middle-clicked, bookmarked and
 * read correctly by a screen reader, and the browser's back button keeps
 * working. A tab strip built out of buttons and client state has none of that.
 *
 * The only reason this is a client component is `usePathname` -- it needs to
 * know which tab is the current page, and a server component cannot ask.
 * Nothing else here is interactive.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface TabItem {
  href: string;
  label: string;
  /**
   * A number shown beside the label. Absent, or zero, shows nothing.
   *
   * Used for "how much is waiting for you here" rather than "how much is in
   * here" -- a badge that is always lit stops meaning anything.
   */
  badge?: number;
}

export function Tabs({ items }: { items: TabItem[] }) {
  const pathname = usePathname();

  /*
   * The longest matching href wins.
   *
   * Every tab here hangs off the same prefix, so /admin/<id> is a prefix of
   * /admin/<id>/reviews and a naive `startsWith` would light up Overview on
   * every page. Taking the longest match instead means a nested page such as
   * /admin/<id>/reviews/<sessionId> still highlights Reviews.
   */
  const active = items.reduce<TabItem | null>((best, item) => {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!matches) return best;
    return !best || item.href.length > best.href.length ? item : best;
  }, null);

  return (
    <nav
      aria-label="Sections"
      className="-mx-4 overflow-x-auto border-b border-outline-variant px-4 sm:-mx-6 sm:px-6"
    >
      <ul className="flex min-w-max">
        {items.map((item) => {
          const current = item === active;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={[
                  "m3-state-layer relative flex h-12 items-center gap-2 px-4",
                  "text-title-small whitespace-nowrap",
                  current ? "text-primary" : "text-on-surface-variant",
                ].join(" ")}
              >
                {item.label}

                {item.badge ? (
                  <span
                    className={[
                      "rounded-full px-1.5 py-0.5 text-label-small",
                      current
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-highest text-on-surface-variant",
                    ].join(" ")}
                  >
                    {item.badge}
                  </span>
                ) : null}

                {/* The indicator. M3 puts a 3px bar under the active tab with
                    the top corners rounded, sitting on top of the strip's own
                    bottom border rather than replacing it. */}
                {current ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-px h-[3px] rounded-t-full bg-primary"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
