/**
 * Environment variables, read in one place.
 *
 * Reading them here rather than sprinkling `process.env.X` through the codebase
 * means a missing variable produces one clear error naming the variable and
 * where to set it, instead of a confusing crash deep inside a page.
 *
 * This module is server-only. Nothing here is ever sent to the browser.
 */

import "server-only";

class MissingEnvError extends Error {
  constructor(name: string, hint: string) {
    super(
      `Missing environment variable ${name}.\n\n${hint}\n\n` +
        `Set it in .env.local for local development, or in Project Settings -> ` +
        `Environment Variables on Vercel. See README.md.`,
    );
    this.name = "MissingEnvError";
  }
}

function required(name: string, hint: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new MissingEnvError(name, hint);
  }
  return value;
}

/** Postgres connection string. Neon and Vercel Postgres both provide one. */
export function databaseUrl(): string {
  return required(
    "DATABASE_URL",
    "This is the Postgres connection string. On Neon it is on the project " +
      "dashboard under Connection Details -- use the pooled one.",
  );
}

/** The single admin password. There are no admin accounts, just this. */
export function adminPassword(): string {
  return required(
    "ADMIN_PASSWORD",
    "Pick a long random password. This is the only thing standing between the " +
      "internet and your admin area.",
  );
}

/**
 * Key used to sign the admin session cookie so it cannot be forged.
 *
 * Optional. If unset it is derived from ADMIN_PASSWORD, which is safe -- the
 * side effect is that changing the admin password logs you out everywhere,
 * which is what you would want anyway. Set it explicitly if you would rather
 * change the password without being logged out.
 */
export function sessionSecret(): string {
  const explicit = process.env.SESSION_SECRET;
  if (explicit && explicit.trim() !== "") return explicit;
  return `derived-from-admin-password:${adminPassword()}`;
}

/** True when an admin password is configured at all. Lets the sign-in page
 *  explain itself instead of throwing when the variable is missing. */
export function hasAdminPassword(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim() !== "");
}

/**
 * Token for the Vercel Blob store that holds uploaded prototype files.
 *
 * Vercel sets this automatically once a Blob store is connected to the
 * project. Locally you get it with `vercel env pull`.
 */
export function blobToken(): string {
  return required(
    "BLOB_READ_WRITE_TOKEN",
    "This is the Vercel Blob store token, used to store uploaded prototype " +
      "HTML. Create a Blob store in the Vercel dashboard under Storage, " +
      "connect it to this project, then run `vercel env pull` to copy the " +
      "token into .env.local.",
  );
}

/** True when a Blob store is configured. Lets the upload form explain itself
 *  before you fill it in, rather than failing on submit. */
export function hasBlobToken(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.trim() !== "",
  );
}

/**
 * Key for the Anthropic API, used by the reviewer assistant.
 *
 * Server only. It must never be sent to the browser -- every call to Claude
 * goes through /api/chat, which runs on the server for exactly this reason.
 */
export function anthropicApiKey(): string {
  return required(
    "ANTHROPIC_API_KEY",
    "This is the key for the AI assistant, from console.anthropic.com. " +
      "It is read only on the server and never reaches the browser.",
  );
}

/** True when the assistant is configured. Lets the review page say so rather
 *  than failing on the reviewer's first message. */
export function hasAnthropicApiKey(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== "",
  );
}

/** True when the database is configured at all. Lets pages show a friendly
 *  "not connected yet" state instead of a stack trace. */
export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "");
}
