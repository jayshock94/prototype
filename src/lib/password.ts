/**
 * Reviewer password hashing.
 *
 * Each prototype has its own reviewer password. We store a hash, never the
 * password itself, so a copy of the database does not hand someone access to
 * every prototype.
 *
 * This uses PBKDF2 from the Web Crypto API rather than bcrypt or argon2. Those
 * are stronger per unit of work, but both are native modules that have to be
 * compiled for the platform they run on, which is exactly the kind of thing
 * that breaks a deploy. PBKDF2 is built into the runtime, needs no dependency,
 * and at the iteration count below is comfortably strong enough for a password
 * that gates a design prototype.
 *
 * Stored format:  pbkdf2$sha256$<iterations>$<salt-base64>$<hash-base64>
 *
 * Keeping the parameters in the string means the iteration count can be raised
 * later without invalidating existing passwords -- old hashes still say how
 * they were made.
 */

const ALGORITHM = "pbkdf2";
const DIGEST = "sha256";

/** OWASP's recommended minimum for PBKDF2-HMAC-SHA256. Roughly 100ms of work. */
const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      // BufferSource typing: a Uint8Array view is what the API actually wants.
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    key,
    KEY_BITS,
  );

  return new Uint8Array(bits);
}

/** Hash a password for storage. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return [ALGORITHM, DIGEST, ITERATIONS, toBase64(salt), toBase64(hash)].join("$");
}

/**
 * Check a password against a stored hash.
 *
 * Comparison is constant time: it looks at every byte regardless of where the
 * first difference is, so the time taken does not leak how much of a guess was
 * correct.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5) return false;

  const [algorithm, digest, iterationsRaw, saltRaw, hashRaw] = parts;
  if (algorithm !== ALGORITHM || digest !== DIGEST) return false;

  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 1) return false;

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64(saltRaw);
    expected = fromBase64(hashRaw);
  } catch {
    return false;
  }

  const actual = await derive(password, salt, iterations);
  if (actual.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < actual.length; i += 1) {
    mismatch |= actual[i] ^ expected[i];
  }
  return mismatch === 0;
}
