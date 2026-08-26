import type { CSSProperties } from "react";

import { TopAppBar } from "@/components/m3/top-app-bar";
import { IconButton } from "@/components/m3/icon-button";
import { LogoutIcon } from "@/components/m3/icons";
import { logout } from "../auth-actions";

/**
 * Chrome shared by every *signed-in* admin page.
 *
 * This sits in a `(dashboard)` route group, and the reason matters. Parentheses
 * make a folder invisible to routing -- this file still wraps /admin, not
 * /admin/dashboard. What it buys us is that /admin/login sits outside the group
 * and so does not inherit this layout. Before that split, the login page
 * rendered the app bar and a "Sign out" button to someone who was not signed in.
 *
 * Any admin page added in a later chunk belongs inside this group. Middleware
 * has already checked the session by the time it renders, so it can assume an
 * admin is present.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-dvh bg-surface-container-lowest"
      /*
       * Any container that sets a surface background and may hold text fields
       * has to announce which surface it is, so a field's floating label can
       * paint a notch that matches. Card does this for itself; a layout has to
       * say it explicitly. Keep this in step with the background class above.
       */
      style={
        {
          "--m3-field-surface": "var(--md-sys-color-surface-container-lowest)",
        } as CSSProperties
      }
    >
      <TopAppBar
        overline="Admin"
        title="Prototype Review Portal"
        actions={
          <form action={logout}>
            <IconButton type="submit" aria-label="Sign out">
              <LogoutIcon />
            </IconButton>
          </form>
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
