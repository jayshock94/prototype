/**
 * Admin authentication.
 *
 * The security model from CLAUDE.md, deliberately simple: one password in an
 * environment variable, no user accounts. Getting the password right hands you
 * a cookie; the cookie is what every later request is checked against.
 *
 * The cookie is not just a flag saying "logged in" -- anyone can set one of
 * those in their browser. It carries an expiry timestamp and an HMAC signature
 * of that timestamp, made with a secret only the server knows. See
 * src/lib/signing.ts for how that works.
 */

import { adminPassword, sessionSecret } from "@/lib/env";
import { signValue, timingSafeEqual, verifyValue } from "@/lib/signing";

export const ADMIN_COOKIE = "prp_admin";

/** How long a login lasts before the admin has to type the password again. */
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12; // 12 hours

/** Names what this signed value is for, so it cannot be replayed elsewhere. */
const PREFIX = "admin";

/** Is this the admin password? */
export function isValidAdminPassword(candidate: string): boolean {
  return timingSafeEqual(candidate, adminPassword());
}

/** Build a signed cookie value carrying its own expiry. */
export async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  return signValue(`${PREFIX}:${expiresAt}`, sessionSecret());
}

/** Is this cookie value genuine and still in date? */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const payload = await verifyValue(token, sessionSecret());
  if (!payload) return false;

  const [prefix, expiresRaw] = payload.split(":");
  if (prefix !== PREFIX) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt)) return false;

  return Date.now() < expiresAt;
}

/** Cookie options shared by the login action and the logout action. */
export function adminCookieOptions() {
  return {
    httpOnly: true, // JavaScript in the page cannot read it, so XSS cannot steal it
    sameSite: "lax" as const, // not sent on cross-site requests
    secure: process.env.NODE_ENV === "production", // HTTPS only once deployed
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  };
}
