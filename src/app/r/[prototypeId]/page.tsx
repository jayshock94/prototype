import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { Card } from "@/components/m3/card";
import { LockIcon } from "@/components/m3/icons";
import { getDb } from "@/db";
import { prototype, version } from "@/db/schema";
import { hasValidPass, passCookieName } from "@/lib/reviewer-auth";
import { NameForm } from "./name-form";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = {
  title: "Review",
  robots: { index: false, follow: false },
};

// Reads cookies and the database on every request; nothing here can be cached.
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The reviewer's entry point, and the only public route in the application.
 *
 * It shows one of two steps:
 *
 *   no valid pass   the password screen
 *   valid pass      the name screen
 *
 * The name screen appears on *every* arrival here, even when the pass cookie is
 * still good. CLAUDE.md is explicit that the name is never remembered, and each
 * arrival starts a fresh session row. Once the name is submitted the reviewer
 * is sent to /review, so refreshing the prototype itself does not re-ask.
 */
export default async function ReviewerEntryPage({
  params,
}: {
  params: Promise<{ prototypeId: string }>;
}) {
  const { prototypeId } = await params;
  if (!UUID.test(prototypeId)) notFound();

  const db = getDb();
  const [row] = await db
    .select({
      id: prototype.id,
      name: prototype.name,
      description: prototype.description,
      reviewerNames: prototype.reviewerNames,
    })
    .from(prototype)
    .where(eq(prototype.id, prototypeId))
    .limit(1);

  if (!row) notFound();

  const [current] = await db
    .select({ label: version.label, changedNote: version.changedNote })
    .from(version)
    .where(and(eq(version.prototypeId, prototypeId), eq(version.isCurrent, true)))
    .limit(1);

  const store = await cookies();
  const passed = await hasValidPass(
    store.get(passCookieName(prototypeId))?.value,
    prototypeId,
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-container-lowest px-4 py-12">
      <Card variant="elevated" className="w-full max-w-sm p-8">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <LockIcon />
          </span>
          <div>
            <p className="text-label-medium text-on-surface-variant">
              Prototype review
            </p>
            <h1 className="text-headline-small text-on-surface">{row.name}</h1>
            <p className="mt-2 text-body-medium text-on-surface-variant">
              {passed
                ? "Who is reviewing today?"
                : "Enter the password you were sent."}
            </p>
          </div>
        </div>

        {passed ? (
          <NameForm prototypeId={row.id} reviewerNames={row.reviewerNames} />
        ) : (
          <PasswordForm prototypeId={row.id} />
        )}

        {!passed && current?.changedNote ? (
          <p className="mt-6 text-body-small text-on-surface-variant">
            {current.label}: {current.changedNote}
          </p>
        ) : null}
      </Card>
    </main>
  );
}
