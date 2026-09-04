import type { Metadata } from "next";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getDb } from "@/db";
import {
  annotation,
  criterion,
  feedback,
  notBuilt,
  prototype,
  session,
  task,
  version,
} from "@/db/schema";
import { MAX_KNOWLEDGE_BASE_BYTES } from "@/lib/prototype-storage";
import { DeletePrototype } from "./delete-prototype";
import { EditPrototypeForm } from "./edit-prototype-form";

export const metadata: Metadata = { title: "Edit prototype · Admin" };

// Always read fresh. A cached edit form would hand you stale values to save
// over the top of, quietly undoing a change made somewhere else.
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPrototypePage({
  params,
}: {
  params: Promise<{ prototypeId: string }>;
}) {
  const { prototypeId } = await params;

  // Checked before the query so a nonsense id is a 404 rather than a database
  // error about an invalid uuid.
  if (!UUID_PATTERN.test(prototypeId)) notFound();

  const db = getDb();

  const [row] = await db
    .select()
    .from(prototype)
    .where(eq(prototype.id, prototypeId))
    .limit(1);

  if (!row) notFound();

  // The briefing is stored on the version, not the prototype, so the form
  // needs whichever version is current.
  const [current] = await db
    .select({
      id: version.id,
      label: version.label,
      knowledgeBaseText: version.knowledgeBaseText,
      scenario: version.scenario,
    })
    .from(version)
    .where(and(eq(version.prototypeId, prototypeId), eq(version.isCurrent, true)))
    .limit(1);

  // Three small lists for one version. Fetched in parallel because they do not
  // depend on each other, and ordered explicitly -- without sort_order Postgres
  // is free to hand them back in any order, which would shuffle the form every
  // time it was saved.
  const [tasks, criteria, notBuiltRows] = current
    ? await Promise.all([
        db
          .select({
            id: task.id,
            goal: task.goal,
            successState: task.successState,
          })
          .from(task)
          .where(eq(task.versionId, current.id))
          .orderBy(asc(task.sortOrder)),
        db
          .select({
            id: criterion.id,
            ref: criterion.ref,
            text: criterion.text,
            verifiableInPrototype: criterion.verifiableInPrototype,
          })
          .from(criterion)
          .where(eq(criterion.versionId, current.id))
          .orderBy(asc(criterion.sortOrder)),
        db
          .select({ text: notBuilt.text })
          .from(notBuilt)
          .where(eq(notBuilt.versionId, current.id))
          .orderBy(asc(notBuilt.sortOrder)),
      ])
    : [[], [], []];

  /*
   * What deleting this would destroy.
   *
   * Four separate counts rather than one clever query: they count rows in four
   * tables joined in three different shapes, and a single query that produced
   * all four would need enough DISTINCTs to be worth nobody's time to read.
   * This page is already doing half a dozen queries and is not on a hot path.
   */
  const [[versionTally], [reviewTally], [findingTally], [shotTally]] =
    await Promise.all([
      db
        .select({ n: count() })
        .from(version)
        .where(eq(version.prototypeId, prototypeId)),
      db
        .select({ n: count() })
        .from(session)
        .innerJoin(version, eq(version.id, session.versionId))
        .where(eq(version.prototypeId, prototypeId)),
      db
        .select({ n: count() })
        .from(feedback)
        .innerJoin(session, eq(session.id, feedback.sessionId))
        .innerJoin(version, eq(version.id, session.versionId))
        .where(eq(version.prototypeId, prototypeId)),
      db
        .select({ n: count(sql`case when ${annotation.screenshotBlobUrl} is not null then 1 end`) })
        .from(annotation)
        .innerJoin(session, eq(session.id, annotation.sessionId))
        .innerJoin(version, eq(version.id, session.versionId))
        .where(eq(version.prototypeId, prototypeId)),
    ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h2 className="text-title-large text-on-surface">Settings</h2>
        <p className="mt-1 text-body-medium text-on-surface-variant">
          Changes are live for reviewers as soon as you save. The reviewer link
          does not change.
          {current ? ` The knowledge base below belongs to ${current.label}.` : ""}
        </p>
      </div>

      <EditPrototypeForm
        prototypeId={prototypeId}
        hasCurrentVersion={Boolean(current)}
        maxKnowledgeBaseBytes={MAX_KNOWLEDGE_BASE_BYTES}
        briefing={{
          mode: row.mode,
          tasks: tasks.map((t) => ({
            id: t.id,
            goal: t.goal,
            successState: t.successState ?? "",
          })),
          criteria: criteria.map((c) => ({
            id: c.id,
            ref: c.ref ?? "",
            text: c.text,
            verifiableInPrototype: c.verifiableInPrototype,
          })),
        }}
        initial={{
          name: row.name,
          ticket: row.ticket ?? "",
          description: row.description ?? "",
          // The form edits this as one-per-line text and the action parses it
          // back into an array, which is the same round trip the create form
          // makes.
          reviewerNames: row.reviewerNames.join("\n"),
          knowledgeBaseText: current?.knowledgeBaseText ?? "",
          scenario: current?.scenario ?? "",
          notBuilt: notBuiltRows.map((n) => n.text).join("\n"),
        }}
      />

      <DeletePrototype
        prototypeId={prototypeId}
        name={row.name}
        tally={{
          versions: versionTally.n,
          reviews: reviewTally.n,
          findings: findingTally.n,
          screenshots: shotTally.n,
        }}
      />
    </div>
  );
}
