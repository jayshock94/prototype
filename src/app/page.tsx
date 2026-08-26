import { redirect } from "next/navigation";

/**
 * There is no public home page. Per the security model in CLAUDE.md the only
 * public route is the reviewer entry page, and that is reached through a
 * per-prototype /r/[prototypeId] link, not from here.
 *
 * Anyone landing on the root goes to the admin area, where middleware will
 * bounce them to the login screen unless they already have a session.
 */
export default function Home() {
  redirect("/admin");
}
