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
import { and, eq, notInArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  annotation,
  criterion,
  notBuilt,
  prototype,
  session,
  task,
  version,
} from "@/db/schema";
import {
  isAssistantMode,
  type AssistantMode,
  parseCriteria,
  parseNotBuilt,
  parseTasks,
  type CriterionDraft,
  type TaskDraft,
} from "@/lib/briefing";
import { hashPassword } from "@/lib/password";
import {
  MAX_KNOWLEDGE_BASE_BYTES,
  deleteBlobs,
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

  // The briefing: what the assistant is told about this prototype beyond its
  // name and knowledge base. Parsing lives in @/lib/briefing so it can be read
  // on its own.
  const modeRaw = String(formData.get("mode") ?? "");
  const scenario = String(formData.get("scenario") ?? "").trim();
  const notBuiltRaw = String(formData.get("notBuilt") ?? "");
  const tasks = parseTasks(formData);
  const criteria = parseCriteria(formData);
  const notBuiltItems = parseNotBuilt(notBuiltRaw);

  // Echoed back on failure so nothing typed is lost. The password is
  // deliberately not echoed.
  const values = {
    name,
    ticket,
    description,
    reviewerNames: reviewerNamesRaw,
    knowledgeBaseText,
    scenario,
    notBuilt: notBuiltRaw,
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

  // The picker can only offer the three, so anything else was not typed by a
  // person using the form.
  if (!isAssistantMode(modeRaw)) {
    fieldErrors.mode = "Choose how the assistant should behave.";
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
          // Validated above, so the cast is checking what has been checked.
          mode: modeRaw as AssistantMode,
          ...(passwordHash ? { passwordHash } : {}),
        })
        .where(eq(prototype.id, prototypeId))
        .returning({ id: prototype.id });

      // Nothing was updated, which means the row is gone -- deleted in another
      // tab, most likely. Say so rather than reporting a save that did nothing.
      if (updated.length === 0) return false;

      // The knowledge base, the scenario, the tasks, the criteria and the
      // not-built list all belong to the *version*, not the prototype, so an
      // old version keeps the briefing it was actually reviewed against.
      // Scoping by prototype id as well as is_current means this can only ever
      // touch a version of *this* prototype.
      const [current] = await tx
        .update(version)
        .set({
          knowledgeBaseText: knowledgeBase || null,
          scenario: scenario || null,
        })
        .where(
          and(eq(version.prototypeId, prototypeId), eq(version.isCurrent, true)),
        )
        .returning({ id: version.id });

      // A prototype with no current version has nowhere to put a briefing.
      // The prototype's own fields are still saved, which is what the form
      // says will happen.
      if (!current) return true;

      await writeTasks(tx, current.id, tasks);
      await writeCriteria(tx, current.id, criteria);

      // The not-built list has nothing pointing at it, so it is the one list
      // that can safely be replaced outright.
      await tx.delete(notBuilt).where(eq(notBuilt.versionId, current.id));
      if (notBuiltItems.length > 0) {
        await tx.insert(notBuilt).values(
          notBuiltItems.map((text, index) => ({
            versionId: current.id,
            sortOrder: index,
            text,
          })),
        );
      }

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


/* --------------------------------------------------------------------------
 * Writing the two lists that other rows point at.
 *
 * Not "delete everything and insert the new list". A reviewer's verdict on a
 * criterion lives in ac_result and cascades when the criterion is deleted, so
 * a wholesale replace would throw away every acceptance result on this version
 * the moment somebody corrected a spelling mistake. Tasks get the same
 * treatment because task results arrive in the next chunk.
 *
 * So: rows that came back with an id are updated in place, rows without one
 * are inserted, and rows that were on the version but did not come back are
 * deleted -- which is a real deletion, taking its results with it, because
 * that is what removing a criterion means.
 *
 * The ids arrive from the browser and are therefore not trusted. Every update
 * is scoped to the version being edited, so an id belonging to another version
 * matches nothing and is written as a new row instead of hijacking someone
 * else's.
 * ------------------------------------------------------------------------ */

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function writeTasks(tx: Tx, versionId: string, drafts: TaskDraft[]) {
  const existing = await tx
    .select({ id: task.id })
    .from(task)
    .where(eq(task.versionId, versionId));
  const known = new Set(existing.map((row) => row.id));

  const keep: string[] = [];

  for (const [index, draft] of drafts.entries()) {
    const values = {
      sortOrder: index,
      goal: draft.goal,
      successState: draft.successState || null,
    };

    if (draft.id && known.has(draft.id)) {
      await tx
        .update(task)
        .set(values)
        .where(and(eq(task.id, draft.id), eq(task.versionId, versionId)));
      keep.push(draft.id);
    } else {
      const [inserted] = await tx
        .insert(task)
        .values({ versionId, ...values })
        .returning({ id: task.id });
      keep.push(inserted.id);
    }
  }

  await tx
    .delete(task)
    .where(
      keep.length > 0
        ? and(eq(task.versionId, versionId), notInArray(task.id, keep))
        : eq(task.versionId, versionId),
    );
}

async function writeCriteria(tx: Tx, versionId: string, drafts: CriterionDraft[]) {
  const existing = await tx
    .select({ id: criterion.id })
    .from(criterion)
    .where(eq(criterion.versionId, versionId));
  const known = new Set(existing.map((row) => row.id));

  const keep: string[] = [];

  for (const [index, draft] of drafts.entries()) {
    const values = {
      sortOrder: index,
      ref: draft.ref || null,
      text: draft.text,
      verifiableInPrototype: draft.verifiableInPrototype,
    };

    if (draft.id && known.has(draft.id)) {
      await tx
        .update(criterion)
        .set(values)
        .where(
          and(eq(criterion.id, draft.id), eq(criterion.versionId, versionId)),
        );
      keep.push(draft.id);
    } else {
      const [inserted] = await tx
        .insert(criterion)
        .values({ versionId, ...values })
        .returning({ id: criterion.id });
      keep.push(inserted.id);
    }
  }

  await tx
    .delete(criterion)
    .where(
      keep.length > 0
        ? and(eq(criterion.versionId, versionId), notInArray(criterion.id, keep))
        : eq(criterion.versionId, versionId),
    );
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

/* --------------------------------------------------------------------------
 * Deleting a prototype
 * ------------------------------------------------------------------------ */

export type DeletePrototypeState = { error?: string };

/**
 * Delete a prototype and everything hanging off it.
 *
 * This is the only genuinely irreversible thing in the admin area. Every
 * version, every review session, every conversation, every finding and every
 * screenshot goes, and there is no bin to fish them back out of. Three things
 * follow from that:
 *
 *  - **The name has to be typed.** The confirmation field is not decoration
 *    and it is checked here, not only in the browser: a disabled button is a
 *    courtesy, not a control, and this action can be called without one.
 *  - **The rows go first, the files second.** Postgres cascades handle every
 *    table; Blob storage has no idea any of this happened, so the URLs are
 *    read out *before* the delete and the files are removed afterwards. Doing
 *    it the other way round would mean a failure between the two left rows
 *    pointing at files that no longer exist -- a prototype that looks fine in
 *    the list and 404s when you open it.
 *  - **A failed cleanup is not reported.** By then the prototype is gone, and
 *    telling somebody that a deletion they cannot undo half-failed is both
 *    alarming and, for them, unactionable.
 *
 * Like updatePrototype, the id is bound to the action rather than posted, so
 * the browser cannot repoint a delete at a different prototype. The admin
 * session is checked by middleware, which covers /admin/:path* -- and a server
 * action posts to the page's own URL, so it is covered too.
 */
export async function deletePrototype(
  prototypeId: string,
  _previousState: DeletePrototypeState,
  formData: FormData,
): Promise<DeletePrototypeState> {
  if (!UUID_PATTERN.test(prototypeId)) {
    return { error: "That prototype does not exist." };
  }

  const db = getDb();

  const [row] = await db
    .select({ id: prototype.id, name: prototype.name })
    .from(prototype)
    .where(eq(prototype.id, prototypeId))
    .limit(1);

  if (!row) {
    // Already gone. Nothing to do and nothing to complain about.
    redirect("/admin");
  }

  const typed = String(formData.get("confirmName") ?? "").trim();
  if (typed !== row.name.trim()) {
    return {
      error: `Type the prototype's name exactly — "${row.name}" — to delete it.`,
    };
  }

  // Every file this prototype owns, collected while the rows still exist.
  const [versionRows, annotationRows] = await Promise.all([
    db
      .select({ htmlBlobUrl: version.htmlBlobUrl })
      .from(version)
      .where(eq(version.prototypeId, prototypeId)),
    db
      .select({ screenshotBlobUrl: annotation.screenshotBlobUrl })
      .from(annotation)
      .innerJoin(session, eq(session.id, annotation.sessionId))
      .innerJoin(version, eq(version.id, session.versionId))
      .where(eq(version.prototypeId, prototypeId)),
  ]);

  await db.delete(prototype).where(eq(prototype.id, prototypeId));

  await deleteBlobs([
    ...versionRows.map((v) => v.htmlBlobUrl),
    ...annotationRows.map((a) => a.screenshotBlobUrl),
  ]);

  revalidatePath("/admin");
  redirect("/admin");
}
