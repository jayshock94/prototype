/**
 * Reviewer access to one prototype.
 *
 * The model from CLAUDE.md: a reviewer types the prototype's password, then
 * picks their name. There are no reviewer accounts, and the name is not a
 * credential -- it only labels the feedback they leave.
 *
 * Two separate cookies, because they answer two different questions and have
 * very different lifetimes:
 *
 *   pass    "this browser got the password for prototype X right"
 *   session "this visit is session Y"
 *
 * Both are scoped per prototype, so a reviewer who has access to one prototype
 * has no access to another.
 *
 * The pass cookie has NO maxAge on purpose. That makes it a session cookie,
 * which the browser throws away when it closes -- so a new visit asks for the
 * password again, as the security model requires. Within one browsing session
 * a refresh does not re-prompt.
 *
 * The name is never stored in a cookie. CLAUDE.md is explicit that it must be
 * asked every time, and /r/[prototypeId] always shows the name step and always
 * starts a new session row, even when the pass cookie is still valid.
 */

import { sessionSecret } from "@/lib/env";
import { signValue, verifyValue } from "@/lib/signing";

/** Distinct prefixes so neither cookie can stand in for the other, or for an
 *  admin session, even though all three share one signing secret. */
const PASS_PREFIX = "rev-pass";
const SESSION_PREFIX = "rev-session";

/**
 * How long a pass is good for even if the browser stays open. A reviewer
 * working through a prototype for an afternoon should not be interrupted; one
 * who leaves a tab open for a week should be.
 */
const PASS_DURATION_MS = 1000 * 60 * 60 * 8; // 8 hours

export function passCookieName(prototypeId: string): string {
  return `prp_pass_${prototypeId}`;
}

export function sessionCookieName(prototypeId: string): string {
  return `prp_sess_${prototypeId}`;
}

export async function createPassToken(prototypeId: string): Promise<string> {
  const expiresAt = Date.now() + PASS_DURATION_MS;
  return signValue(`${PASS_PREFIX}:${prototypeId}:${expiresAt}`, sessionSecret());
}

/** Has this browser passed the password step for this prototype? */
export async function hasValidPass(
  token: string | undefined,
  prototypeId: string,
): Promise<boolean> {
  const payload = await verifyValue(token, sessionSecret());
  if (!payload) return false;

  const [prefix, id, expiresRaw] = payload.split(":");
  // The prototype id is inside the signature, so a pass for one prototype
  // cannot be moved to another by renaming the cookie.
  if (prefix !== PASS_PREFIX || id !== prototypeId) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt)) return false;

  return Date.now() < expiresAt;
}

export async function createSessionToken(
  prototypeId: string,
  sessionId: string,
): Promise<string> {
  return signValue(`${SESSION_PREFIX}:${prototypeId}:${sessionId}`, sessionSecret());
}

/** The session id this visit belongs to, or null. */
export async function readSessionId(
  token: string | undefined,
  prototypeId: string,
): Promise<string | null> {
  const payload = await verifyValue(token, sessionSecret());
  if (!payload) return null;

  const [prefix, id, sessionId] = payload.split(":");
  if (prefix !== SESSION_PREFIX || id !== prototypeId) return null;

  return sessionId || null;
}

/**
 * A session cookie: no maxAge, so it dies when the browser closes and the next
 * visit starts from the password screen again.
 */
export function reviewerCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
