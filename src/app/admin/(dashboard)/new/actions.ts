"use server";

/**
 * Creating a prototype.
 *
 * By the time this runs the HTML is already in Blob storage: the browser
 * uploaded it directly, using a token issued by /api/prototype-upload. What
 * arrives here is the blob's URL, not the file, which is what keeps prototype
 * size independent of Vercel's 4.5 MB limit on a function request body.
 *
 * That means the blob reference is user input and cannot be taken on trust. It
 * is checked three ways before anything is written: `head` confirms the blob
 * really exists in *our* store, the pathname must belong to the prototype id
 * being claimed, and the first bytes are read back to confirm the file is
 * actually HTML.
 *
 * The two rows are written in one transaction, so a prototype can never exist
 * without its first version. If anything is rejected, the orphaned blob is
 * deleted -- otherwise a refused upload would sit in the store forever with
 * nothing pointing at it.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { prototype, version } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import {
  MAX_KNOWLEDGE_BASE_BYTES,
  MAX_PROTOTYPE_BYTES,
  deletePrototypeBlob,
  formatBytes,
  headPrototypeBlob,
  pathnameBelongsToPrototype,
  readPrototypeHead,
} from "@/lib/prototype-storage";
import { parseReviewerNames } from "@/lib/reviewer-names";
import { looksLikeHtml } from "./looks-like-html";

export type NewPrototypeState = {
  error?: string;
  /** Field-specific messages, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** What was typed, so a rejected form comes back filled in. */
  values?: Record<string, string>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createPrototype(
  _previousState: NewPrototypeState,
  formData: FormData,
): Promise<NewPrototypeState> {
  const name = String(formData.get("name") ?? "").trim();
  const ticket = String(formData.get("ticket") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const reviewerNamesRaw = String(formData.get("reviewerNames") ?? "");
  const knowledgeBaseText = String(formData.get("knowledgeBaseText") ?? "").trim();

  // Written by the browser after it uploads the file straight to Blob.
  const prototypeId = String(formData.get("prototypeId") ?? "");
  const htmlBlobUrl = String(formData.get("htmlBlobUrl") ?? "");

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

  /** Reject, and take the orphaned blob with us. */
  async function reject(state: NewPrototypeState): Promise<NewPrototypeState> {
    if (htmlBlobUrl) await deletePrototypeBlob(htmlBlobUrl);
    return { ...state, values };
  }

  const fieldErrors: Record<string, string> = {};

  if (!name) fieldErrors.name = "Give the prototype a name.";
  if (!password) {
    fieldErrors.password = "Set a password for reviewers.";
  } else if (password.length < 6) {
    fieldErrors.password = "Use at least 6 characters.";
  }

  const reviewerNames = parseReviewerNames(reviewerNamesRaw);
  if (reviewerNames.length === 0) {
    fieldErrors.reviewerNames = "Add at least one reviewer name, one per line.";
  }

  if (!htmlBlobUrl || !prototypeId) {
    fieldErrors.html = "Choose the prototype's HTML file.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return reject({ fieldErrors });
  }

  // --- The blob reference came from the browser, so verify all of it --------

  if (!UUID_PATTERN.test(prototypeId)) {
    return reject({ error: "That upload could not be verified. Please try again." });
  }

  const blob = await headPrototypeBlob(htmlBlobUrl);
  if (!blob) {
    return reject({
      fieldErrors: {
        html: "That upload could not be found in storage. Please choose the file again.",
      },
    });
  }

  if (!pathnameBelongsToPrototype(blob.pathname, prototypeId)) {
    // The uploaded file is not where this prototype's file should be, which
    // means the two were not created by the same request.
    return reject({ error: "That upload could not be verified. Please try again." });
  }

  if (blob.size > MAX_PROTOTYPE_BYTES) {
    return reject({
      fieldErrors: {
        html: `That file is ${formatBytes(blob.size)}. The limit is ${formatBytes(MAX_PROTOTYPE_BYTES)}.`,
      },
    });
  }

  // Read the opening bytes back out of storage. The browser checked this too,
  // but a check that runs in the browser is a convenience, never a guarantee.
  const head = await readPrototypeHead(htmlBlobUrl);
  if (!looksLikeHtml(head)) {
    return reject({
      fieldErrors: {
        html: "That does not look like an HTML file -- no <html> tag was found in it.",
      },
    });
  }

  // --- Knowledge base -------------------------------------------------------

  // A knowledge base file, when supplied, wins over the textarea. Markdown is
  // small, so unlike the prototype it can travel with the form.
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
  const passwordHash = await hashPassword(password);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(prototype).values({
        id: prototypeId,
        name,
        ticket: ticket || null,
        description: description || null,
        passwordHash,
        reviewerNames,
      });

      await tx.insert(version).values({
        prototypeId,
        label: "v1",
        htmlBlobUrl,
        knowledgeBaseText: knowledgeBase || null,
        type: "revision",
        isCurrent: true,
      });
    });
  } catch (error) {
    return reject({
      error:
        "The prototype could not be saved to the database. " +
        (error instanceof Error ? error.message : String(error)),
    });
  }

  revalidatePath("/admin");
  redirect(`/admin/${prototypeId}`);
}
