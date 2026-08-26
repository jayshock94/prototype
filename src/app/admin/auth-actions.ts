"use server";

/**
 * Login and logout, as server actions.
 *
 * A server action is a function that runs on the server but is called from a
 * form in the browser. It means the password is checked, and the cookie set,
 * without writing an API route by hand -- and the password never exists in any
 * JavaScript the browser downloads.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_COOKIE,
  adminCookieOptions,
  createSessionToken,
  isValidAdminPassword,
} from "@/lib/auth";
import { hasAdminPassword } from "@/lib/env";

export type LoginState = { error?: string };

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");

  // Only allow redirecting back to a path on this site. Without this check
  // someone could send a link ending in ?next=https://evil.example and have the
  // login page forward you there afterwards.
  const requested = String(formData.get("next") ?? "/admin");
  const next = requested.startsWith("/") && !requested.startsWith("//")
    ? requested
    : "/admin";

  // Checked here as well as on the page: a form can be submitted without the
  // page having decided to render it, and throwing from here produces an error
  // page that explains nothing.
  if (!hasAdminPassword()) {
    return {
      error:
        "No admin password is configured on the server. Set ADMIN_PASSWORD and redeploy.",
    };
  }

  if (!password) {
    return { error: "Enter the admin password." };
  }

  if (!isValidAdminPassword(password)) {
    // A small delay takes the shine off automated guessing without needing any
    // rate-limiting infrastructure.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { error: "That password is not right." };
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, await createSessionToken(), adminCookieOptions());

  redirect(next);
}

export async function logout() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
