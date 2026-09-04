import type { Metadata } from "next";
import { asc, count, desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/m3/button";
import { CopyLink } from "@/components/m3/copy-link";
import { Card } from "@/components/m3/card";
import { FlagIcon, OpenInNewIcon } from "@/components/m3/icons";
import { getDb } from "@/db";
import { MODE_DESCRIPTIONS, MODE_LABELS } from "@/lib/briefing";
import { criterion, feedback, notBuilt, prototype, session, task, version } from "@/db/schema";

export const metadata: Metadata = { title: "Prototype · Admin" };
export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** A labelled value in the details list. */
function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-label-medium text-on-surface-variant">{label}</dt>
      <dd className="mt-1 text-body-large text-on-surface">{children}</dd>
    </div>
  );
}

export default async function PrototypeDetailPage({
  params,
}: {
  params: Promise<{ prototypeId: string }>;
}) {
  const { prototypeId } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prototypeId)) {
    notFound();
  }

  const db = getDb();

  const [row] = await db
    .select()
    .from(prototype)
    .where(eq(prototype.id, prototypeId))
    .limit(1);

  if (!row) notFound();

  const versions = await db
    .select()
    .from(version)
    .where(eq(version.prototypeId, prototypeId))
    .orderBy(desc(version.createdAt));

  const current = versions.find((v) => v.isCurrent) ?? versions[0];

  // What the assistant has been briefed with on the current version. Counted
  // rather than listed in full -- this page answers "is it set up?", and the
  // edit form answers "set up how?".
  const [tasks, criteria, notBuiltRows] = current
    ? await Promise.all([
        db
          .select({ goal: task.goal })
          .from(task)
          .where(eq(task.versionId, current.id))
          .orderBy(asc(task.sortOrder)),
        db
          .select({ ref: criterion.ref, text: criterion.text })
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

  const briefed =
    tasks.length + criteria.length + notBuiltRows.length > 0 ||
    Boolean(current?.scenario);

  // How much there is to read, and how much of it has not been triaged. The
  // untriaged number is the one that says whether this needs attention today.
  const [tally] = await db
    .select({
      total: count(),
      untriaged: count(
        // count() skips nulls, so counting the *disposition being null* means
        // counting a value that is non-null exactly when the row is untriaged.
        sql`case when ${feedback.disposition} is null then 1 end`,
      ),
    })
    .from(feedback)
    .innerJoin(session, eq(session.id, feedback.sessionId))
    .innerJoin(version, eq(version.id, session.versionId))
    .where(eq(version.prototypeId, prototypeId));

  return (
    <div className="flex flex-col gap-6">
      {row.description ? (
        <Card variant="filled" className="p-6">
          <p className="text-body-large whitespace-pre-line text-on-surface">
            {row.description}
          </p>
        </Card>
      ) : null}

      <Card variant="outlined" className="p-6">
        <dl className="grid gap-6 sm:grid-cols-2">
          <Detail label="Added">{formatDate(row.createdAt)}</Detail>

          <Detail label="Assistant mode">
            {MODE_LABELS[row.mode]}
            <p className="mt-2 text-body-small text-on-surface-variant">
              {MODE_DESCRIPTIONS[row.mode]}
            </p>
          </Detail>

          <Detail label={`Briefing${current ? ` for ${current.label}` : ""}`}>
            {briefed ? (
              <ul className="flex flex-col gap-1 text-body-medium text-on-surface-variant">
                <li>
                  {tasks.length === 0
                    ? "No tasks"
                    : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
                </li>
                <li>
                  {criteria.length === 0
                    ? "No acceptance criteria"
                    : `${criteria.length} acceptance ${criteria.length === 1 ? "criterion" : "criteria"}`}
                </li>
                <li>
                  {notBuiltRows.length === 0
                    ? "Nothing listed as not built"
                    : `${notBuiltRows.length} thing${notBuiltRows.length === 1 ? "" : "s"} listed as not built`}
                </li>
                {current?.scenario ? <li>A scenario is set</li> : null}
              </ul>
            ) : (
              <p className="text-body-medium text-on-surface-variant">
                Nothing yet. The assistant can answer questions from the
                knowledge base, but it has nothing to ask anyone to try and
                cannot tell what is out of scope.
              </p>
            )}
          </Detail>
        </dl>
      </Card>

      <Card variant="outlined" className="p-6">
        <dl className="grid gap-6 sm:grid-cols-2">
          <Detail label="Reviewer link">
            {/* Permanent: it always resolves to whichever version is current,
                so reviewers keep the same link across versions. */}
            <CopyLink path={`/r/${row.id}`} />
            <p className="mt-2 text-body-small text-on-surface-variant">
              Send this with the password. It always opens the current version.
            </p>
          </Detail>

          <Detail label="Reviewers">
            <ul className="flex flex-wrap gap-2">
              {row.reviewerNames.map((name) => (
                <li
                  key={name}
                  className="rounded-full bg-secondary-container px-3 py-1 text-label-medium text-on-secondary-container"
                >
                  {name}
                </li>
              ))}
            </ul>
          </Detail>
        </dl>
      </Card>

      <Card variant="filled" className="flex flex-wrap items-center gap-4 p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant">
          <FlagIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-title-medium text-on-surface">
            {tally.total === 0
              ? "No feedback yet"
              : `${tally.total} ${tally.total === 1 ? "item" : "items"} of feedback`}
          </p>
          <p className="text-body-medium text-on-surface-variant">
            {tally.total === 0
              ? "It appears here as reviewers work through the prototype."
              : tally.untriaged === 0
                ? "All triaged."
                : `${tally.untriaged} still to triage.`}
          </p>
        </div>
        <ButtonLink
          href={`/admin/${row.id}/feedback`}
          variant={tally.untriaged > 0 ? "filled" : "outlined"}
        >
          Read feedback
        </ButtonLink>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-title-large text-on-surface">
          {versions.length === 1 ? "1 version" : `${versions.length} versions`}
        </h2>

        <Card variant="outlined" className="overflow-hidden p-0">
          <ul className="divide-y divide-outline-variant">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-title-medium text-on-surface">
                    {v.label}
                    {v.isCurrent ? (
                      <span className="rounded-full bg-primary-container px-2 py-0.5 text-label-small text-on-primary-container">
                        Current
                      </span>
                    ) : null}
                  </p>
                  <p className="text-body-small text-on-surface-variant">
                    {v.changedNote ?? "No change note"} · {formatDate(v.createdAt)}
                  </p>
                </div>

                <span className="text-body-small text-on-surface-variant">
                  {v.knowledgeBaseText
                    ? `${v.knowledgeBaseText.length.toLocaleString()} chars of knowledge base`
                    : "No knowledge base"}
                </span>

                <ButtonLink
                  href={`/p/${v.id}`}
                  target="_blank"
                  rel="noreferrer"
                  variant="outlined"
                >
                  Open
                </ButtonLink>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
