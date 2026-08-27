"use server";

/**
 * The two steps a reviewer goes through: the password, then their name.
 *
 * Both run on the server. The prototype's password is only ever compared
 * against its stored hash here; the hash never reaches the browser.
 */

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { prototype, session, version } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { isReviewerRole, type ReviewerRole } from "@/lib/reviewer-role";
import {
  createPassToken,
  createSessionToken,
  hasValidPass,
  passCookieName,
  reviewerCookieOptions,
  sessionCookieName,
} from "@/lib/reviewer-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PasswordState = { error?: string };
export type NameState = { error?: string };

export async function enterPassword(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const prototypeId = String(formData.get("prototypeId") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!UUID.test(prototypeId)) return { error: "That link is not valid." };
  if (!password) return { error: "Enter the password." };

  const db = getDb();
  const [row] = await db
    .select({ passwordHash: prototype.passwordHash })
    .from(prototype)
    .where(eq(prototype.id, prototypeId))
    .limit(1);

  // Same message whether the prototype does not exist or the password is
  // wrong, so the form cannot be used to discover which links are real.
  const wrong = { error: "That password is not right." };
  if (!row) {
    await new Promise((r) => setTimeout(r, 400));
    return wrong;
  }

  if (!(await verifyPassword(password, row.passwordHash))) {
    // Takes the shine off automated guessing without any rate-limiting
    // infrastructure. Password checking is already slow by design.
    await new Promise((r) => setTimeout(r, 400));
    return wrong;
  }

  const store = await cookies();
  store.set(
    passCookieName(prototypeId),
    await createPassToken(prototypeId),
    reviewerCookieOptions(),
  );

  // Straight on to the name step, which the page shows once the pass is set.
  redirect(`/r/${prototypeId}`);
}

export async function enterName(
  _previous: NameState,
  formData: FormData,
): Promise<NameState> {
  const prototypeId = String(formData.get("prototypeId") ?? "");
  const choice = String(formData.get("reviewerName") ?? "").trim();
  const otherName = String(formData.get("otherName") ?? "").trim();
  const roleRaw = String(formData.get("reviewerRole") ?? "");

  if (!UUID.test(prototypeId)) return { error: "That link is not valid." };

  const store = await cookies();
  // The name step is only reachable with a valid pass. Checked again here
  // because an action can be called without the page having rendered it.
  const passed = await hasValidPass(
    store.get(passCookieName(prototypeId))?.value,
    prototypeId,
  );
  if (!passed) redirect(`/r/${prototypeId}`);

  const name = choice === "__other__" ? otherName : choice;
  if (!name) {
    return {
      error:
        choice === "__other__" ? "Enter your name." : "Pick your name from the list.",
    };
  }
  if (name.length > 100) return { error: "That name is too long." };

  // The picker only offers the five. Anything else did not come from a person
  // using the form, and "other" is the answer that assumes least about them.
  const reviewerRole: ReviewerRole = isReviewerRole(roleRaw) ? roleRaw : "other";

  const db = getDb();

  // Always the version marked current. The /r/ link is permanent and follows
  // whatever is current, which is what lets a reviewer keep one link forever
  // while versions come and go underneath it.
  const [live] = await db
    .select({ id: version.id })
    .from(version)
    .where(and(eq(version.prototypeId, prototypeId), eq(version.isCurrent, true)))
    .limit(1);

  if (!live) {
    return { error: "This prototype has no current version to review." };
  }

  const [created] = await db
    .insert(session)
    .values({ versionId: live.id, reviewerName: name, reviewerRole })
    .returning({ id: session.id });

  store.set(
    sessionCookieName(prototypeId),
    await createSessionToken(prototypeId, created.id),
    reviewerCookieOptions(),
  );

  redirect(`/r/${prototypeId}/review`);
}
