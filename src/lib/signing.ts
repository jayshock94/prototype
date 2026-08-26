/**
 * Signing and verifying short cookie values.
 *
 * Both the admin session and the reviewer's per-prototype pass are cookies that
 * say "this person got past a password". A cookie is just text the browser
 * sends back, and anyone can set one by hand -- so the value carries an HMAC
 * signature made with a secret only the server knows. Without the secret you
 * cannot produce a matching signature, so you cannot forge the cookie.
 *
 * Web Crypto rather than Node's `crypto`, because middleware runs on the Edge
 * runtime where Node's version is unavailable.
 *
 * Every payload starts with a short prefix naming what it is for. That stops a
 * value minted for one purpose being replayed as another -- an admin session
 * cookie cannot be presented as a reviewer's pass, even though both are signed
 * with the same secret.
 */

const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
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
 * Compare without leaking, through how long it takes, how many characters
 * matched. `===` returns early at the first difference, which is measurable.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Produce "<payload>.<signature>". */
export async function signValue(payload: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(payload),
  );
  return `${payload}.${toHex(signature)}`;
}

/**
 * Check a signed value and hand back the payload, or null if it has been
 * tampered with. Expiry is the caller's business -- this only proves the value
 * came from us.
 */
export async function verifyValue(
  token: string | undefined,
  secret: string,
): Promise<string | null> {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator === -1) return null;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expected = toHex(
    await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload)),
  );

  return timingSafeEqual(signature, expected) ? payload : null;
}
