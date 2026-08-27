"use server";

/**
 * Editing a prototype that already exists.
 *
 * The mirror image of new/actions.ts, minus the file upload. Everything here
 * arrives as ordinary form data, because everything here is small: names, a
 * description, a list of reviewers, and at most a markdown knowledge base.
 * Replacing the prototype's HTML means creating a new *version*, which is a
 * different job and belongs to a later chunk -- see the TODO at the bottom.
 *
 * Two things are worth knowing about what this touches:
 *
 *  - The knowledge base lives on the *version*, not the prototype, so this
 *    writes it to whichever version is currently marked current. Older
 *    versions keep the knowledge base they were reviewed against, which is
 *    what you want when you go back and read old feedback.
 *  - The reviewer password is only rewritten when a new one is typed. Leaving
 *    that field blank keeps the existing hash, so saving a typo fix in the
 *    description never silently locks reviewers out.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { prototype, version } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import {
  MAX_KNOWLEDGE_BASE_BYTES,
  formatBytes,
} from "@/lib/prototype-storage";
import { parseReviewerNames } from "@/lib/reviewer-names";

export type EditPrototypeState = {
  error?: string;
  /** Field-specific messages, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** What was typed, so a rejected form comes back as it was left. */
  values?: Record<string, string>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Minimum length for a reviewer password. Matches the create form. */
const MIN_PASSWORD_LENGTH = 6;

/**
 * `prototypeId` is bound to the action in the form rather than posted as a
 * hidden input, so it cannot be swapped for another id by editing the page.
 */
export async function updatePrototype(
  prototypeId: string,
  _previousState: EditPrototypeState,
  formData: FormData,
): Promise<EditPrototypeState> {
  const name = String(formData.get("name") ?? "").trim();
  const ticket = String(formData.get("ticket") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const reviewerNamesRaw = String(formData.get("reviewerNames") ?? "");
  const knowledgeBaseText = String(formData.get("knowledgeBaseText") ?? "").trim();
  const knowledgeBaseFile = formData.get("knowledgeBaseFile");

  // Echoed back on failure so nothing typed is lost. The password is
  // deliberately not echoed.
  const values = {
    name,
    ticket,
    description,
    reviewerNames: reviewerNamesRaw,
    knowledgeBaseText,
  };

  function reject(state: EditPrototypeState): EditPrototypeState {
    return { ...state, values };
  }

  if (!UUID_PATTERN.test(prototypeId)) {
    return reject({ error: "That prototype could not be found." });
  }

  // --- Validate -------------------------------------------------------------

  const fieldErrors: Record<string, string> = {};

  if (!name) fieldErrors.name = "Give the prototype a name.";

  // Blank means "keep the password you already have", so only a password that
  // was actually typed is checked for length.
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  const reviewerNames = parseReviewerNames(reviewerNamesRaw);
  if (reviewerNames.length === 0) {
    fieldErrors.reviewerNames = "Add at least one reviewer name, one per line.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return reject({ fieldErrors });
  }

  // --- Knowledge base -------------------------------------------------------

  // Same rule as the create form: an uploaded file wins over the textarea.
  // Clearing the textarea and uploading nothing removes the knowledge base.
  let knowledgeBase = knowledgeBaseText;
  if (knowledgeBaseFile instanceof File && knowledgeBaseFile.size > 0) {
    if (knowledgeBaseFile.size > MAX_KNOWLEDGE_BASE_BYTES) {
      return reject({
        fieldErrors: {
          knowledgeBaseFile: `That file is ${formatBytes(knowledgeBaseFile.size)}. The limit is ${formatBytes(MAX_KNOWLEDGE_BASE_BYTES)}.`,
        },
      });
    }
    knowledgeBase = (await knowledgeBaseFile.text()).trim();
  }

  // --- Write ----------------------------------------------------------------

  const db = getDb();

  // Hashing is deliberately slow (see lib/password.ts), so only do it when
  // there is a new password to hash.
  const passwordHash = password ? await hashPassword(password) : null;

  try {
    const saved = await db.transaction(async (tx) => {
      const updated = await tx
        .update(prototype)
        .set({
          name,
          ticket: ticket || null,
          description: description || null,
          reviewerNames,
          ...(passwordHash ? { passwordHash } : {}),
        })
        .where(eq(prototype.id, prototypeId))
        .returning({ id: prototype.id });

      // Nothing was updated, which means the row is gone -- deleted in another
      // tab, most likely. Say so rather than reporting a save that did nothing.
      if (updated.length === 0) return false;

      // The knowledge base belongs to the current version. Scoping the update
      // by prototype id as well as is_current means it can only ever touch a
      // version of *this* prototype.
      await tx
        .update(version)
        .set({ knowledgeBaseText: knowledgeBase || null })
        .where(
          and(eq(version.prototypeId, prototypeId), eq(version.isCurrent, true)),
        );

      return true;
    });

    if (!saved) {
      return reject({
        error: "That prototype no longer exists. It may have been deleted.",
      });
    }
  } catch (error) {
    return reject({
      error:
        "The changes could not be saved to the database. " +
        (error instanceof Error ? error.message : String(error)),
    });
  }

  // The list shows the name and ticket, the detail page shows everything, and
  // both are force-dynamic -- but revalidating is what clears the client-side
  // router cache, without which a back-navigation would show the old values.
  revalidatePath("/admin");
  revalidatePath(`/admin/${prototypeId}`);
  redirect(`/admin/${prototypeId}`);
}

/*
 * TODO (later chunk): replacing the prototype HTML.
 *
 * That is not an edit of this row -- it is a new version: upload the file the
 * way new/new-prototype-form.tsx does, insert a version row with the next
 * label and a change note, and move is_current onto it. The partial unique
 * index on version means the old row has to be cleared in the same
 * transaction.
 */
