/**
 * Admin authentication.
 *
 * The security model from CLAUDE.md, deliberately simple: one password in an
 * environment variable, no user accounts. Getting the password right hands you
 * a cookie; the cookie is what every later request is checked against.
 *
 * The cookie is not just a flag saying "logged in" -- anyone can set one of
 * those in their browser. It carries an expiry timestamp and an HMAC signature
 * of that timestamp made with a secret only the server knows. Without the
 * secret you cannot produce a valid signature, so you cannot forge the cookie.
 *
 * Everything here uses Web Crypto rather than Node's `crypto` module, because
 * middleware runs on the Edge runtime where Node's version is unavailable.
 */

import { adminPassword, sessionSecret } from "@/lib/env";

export const ADMIN_COOKIE = "prp_admin";

/** How long a login lasts before the admin has to type the password again. */
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12; // 12 hours

const encoder = new TextEncoder();

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compare two strings without leaking, through how long the comparison takes,
 * how many characters matched. A normal `===` returns early on the first
 * difference, which an attacker can measure to guess a secret one character at
 * a time. This always looks at every character.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Is this the admin password? */
export function isValidAdminPassword(candidate: string): boolean {
  return timingSafeEqual(candidate, adminPassword());
}

/** Build a signed cookie value: "<expires-at>.<signature>". */
export async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = String(expiresAt);
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    encoder.encode(payload),
  );
  return `${payload}.${toHex(signature)}`;
}

/** Is this cookie value genuine and still in date? */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator === -1) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;
  // Check the signature even when expired, so a valid-but-old cookie and a
  // forged one take the same amount of work to reject.
  const expected = toHex(
    await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(payload)),
  );
  if (!timingSafeEqual(signature, expected)) return false;

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
