"use server";

/**
 * Creating a prototype.
 *
 * Runs entirely on the server: the reviewer password is hashed here and the
 * HTML goes straight to Blob storage without ever touching client JavaScript.
 *
 * Order of operations matters. The file is uploaded to Blob *before* any row is
 * written, so a failed upload leaves the database untouched rather than leaving
 * a prototype pointing at a file that does not exist. The two rows that follow
 * are written in a transaction, so a prototype can never exist without its
 * first version.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { prototype, version } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import {
  MAX_PROTOTYPE_BYTES,
  formatBytes,
  putPrototypeHtml,
} from "@/lib/prototype-storage";
import { looksLikeHtml } from "./looks-like-html";
import { parseReviewerNames } from "./parse-reviewer-names";

export type NewPrototypeState = {
  error?: string;
  /** Field-specific messages, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** What was typed, so a rejected form comes back filled in. */
  values?: Record<string, string>;
};

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

  const htmlFile = formData.get("html");
  const knowledgeBaseFile = formData.get("knowledgeBaseFile");

  // Echoed back on failure so nothing typed is lost. The password is
  // deliberately not echoed.
  const values = { name, ticket, description, reviewerNames: reviewerNamesRaw, knowledgeBaseText };

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

  if (!(htmlFile instanceof File) || htmlFile.size === 0) {
    fieldErrors.html = "Choose the prototype's HTML file.";
  } else if (htmlFile.size > MAX_PROTOTYPE_BYTES) {
    fieldErrors.html = `That file is ${formatBytes(htmlFile.size)}. The limit is ${formatBytes(MAX_PROTOTYPE_BYTES)}.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values };
  }

  const file = htmlFile as File;
  const html = await file.text();

  if (!looksLikeHtml(html)) {
    return {
      fieldErrors: {
        html: "That does not look like an HTML file -- no <html> tag was found in it.",
      },
      values,
    };
  }

  // A knowledge base file, when supplied, wins over the textarea.
  let knowledgeBase = knowledgeBaseText;
  if (knowledgeBaseFile instanceof File && knowledgeBaseFile.size > 0) {
    if (knowledgeBaseFile.size > MAX_PROTOTYPE_BYTES) {
      return {
        fieldErrors: { knowledgeBaseFile: "That file is too large." },
        values,
      };
    }
    knowledgeBase = (await knowledgeBaseFile.text()).trim();
  }

  const db = getDb();
  const passwordHash = await hashPassword(password);

  // The prototype id is needed for the Blob pathname, and the upload has to
  // happen before any row is written, so the id is generated here rather than
  // by the database.
  const prototypeId = crypto.randomUUID();

  let htmlBlobUrl: string;
  try {
    htmlBlobUrl = await putPrototypeHtml({
      prototypeId,
      versionLabel: "v1",
      html,
    });
  } catch (error) {
    return {
      error:
        "The file could not be uploaded to Blob storage. " +
        (error instanceof Error ? error.message : String(error)),
      values,
    };
  }

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
    return {
      error:
        "The prototype could not be saved to the database. " +
        (error instanceof Error ? error.message : String(error)),
      values,
    };
  }

  revalidatePath("/admin");
  redirect(`/admin/${prototypeId}`);
}
