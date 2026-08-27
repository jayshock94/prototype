/**
 * What the reviewer is here as.
 *
 * Picked after their name, and it changes what the assistant asks about rather
 * than how hard it pushes -- that is the prototype's mode. A developer gets
 * asked about the states that are not drawn; a product owner gets asked whether
 * it solves the problem at all.
 *
 * The wording lives here rather than in the picker, because the same sentences
 * are shown to the reviewer *and* given to the assistant. Two copies of an
 * instruction is two things to keep in step, and the one nobody reads is
 * always the one that drifts.
 *
 * Pure, and free of the database, so the reviewer entry page can import it
 * without dragging a server module into the browser bundle.
 */

import type { reviewerRoleEnum } from "@/db/schema";

export type ReviewerRole = (typeof reviewerRoleEnum.enumValues)[number];

/** Offered in this order: most specific first, "someone else" last. */
export const REVIEWER_ROLES = [
  "product_owner",
  "developer",
  "qa",
  "designer",
  "other",
] as const;

/** What the reviewer sees in the picker. */
export const ROLE_LABELS: Record<ReviewerRole, string> = {
  product_owner: "Product owner",
  developer: "Developer",
  qa: "QA",
  designer: "Designer",
  other: "None of these",
};

/** The one-liner under each option. Written for the reviewer, not for Jay. */
export const ROLE_HINTS: Record<ReviewerRole, string> = {
  product_owner: "You care whether this solves the problem the ticket describes.",
  developer: "You will build it, so you want the states nobody drew.",
  qa: "You want to know what happens when someone does the wrong thing.",
  designer: "You are looking at patterns and whether this matches the rest.",
  other: "Plain language, no jargon, no ticket numbers.",
};

/** What the assistant is told to do differently. Taken from prompts/assistant.md. */
export const ROLE_INSTRUCTIONS: Record<ReviewerRole, string> = {
  product_owner:
    "Ask whether this solves the problem, whether anything is missing from the criteria, and what the ticket never mentioned.",
  developer:
    "Ask about the states that are not shown, where the data comes from, and what breaks.",
  qa: "Ask about error states, boundaries, and what happens when someone does the wrong thing.",
  designer:
    "Ask about patterns, consistency, and whether this matches how the rest of the product works.",
  other:
    "Use plain language. No ticket numbers, no jargon. Walk them through it like a normal person.",
};

export function isReviewerRole(value: unknown): value is ReviewerRole {
  return (
    typeof value === "string" && (REVIEWER_ROLES as readonly string[]).includes(value)
  );
}
