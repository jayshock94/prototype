import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { ChevronRightIcon, DownloadIcon, InventoryIcon } from "@/components/m3/icons";
import { getDb } from "@/db";
import { feedback, message, session, version } from "@/db/schema";
import { ROLE_LABELS } from "@/lib/reviewer-role";

export const metadata: Metadata = { title: "Reviews · Admin" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Who came, and what happened when they did.
 *
 * The Feedback tab pools every finding and sorts it by how bad it is, which is
 * the right shape for triage and the wrong shape for the other question a
 * designer asks: *what did this person make of it?* A finding read on its own
 * loses the four messages either side of it that explain why it was raised.
 *
 * So this lists visits, in the order they happened, and each one opens the
 * whole session -- findings and conversation together. A review that logged
 * nothing still appears: somebody looking round for ten minutes and raising
 * nothing is a result, and it is invisible on a page that only lists findings.
 */
export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ prototypeId: string }>;
}) {
  const { prototypeId } = await params;
  if (!UUID.test(prototypeId)) notFound();

  const db = getDb();

  /*
   * One row per visit, with its two counts.
   *
   * The counts are correlated subqueries rather than joins, because joining
   * both feedback and message to session multiplies them together -- three
   * findings and eight messages would report twenty-four of each. That bug is
   * silent and looks like a busy reviewer.
   */
  const rows = await db
    .select({
      id: session.id,
      reviewerName: session.reviewerName,
      reviewerRole: session.reviewerRole,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      versionLabel: version.label,
      findings: sql<number>`(
        select count(*)::int from ${feedback}
        where ${feedback.sessionId} = ${session.id}
      )`,
      messages: sql<number>`(
        select count(*)::int from ${message}
        where ${message.sessionId} = ${session.id}
      )`,
    })
    .from(session)
    .innerJoin(version, eq(version.id, session.versionId))
    .where(eq(version.prototypeId, prototypeId))
    .orderBy(desc(session.startedAt));

  if (rows.length === 0) {
    return (
      <Card variant="filled" className="px-6 py-16">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant">
            <InventoryIcon />
          </span>
          <h2 className="text-title-large text-on-surface">Nobody has been yet</h2>
          <p className="text-body-medium text-on-surface-variant">
            Each visit appears here as soon as somebody enters the password and
            picks their name, whether or not they log anything.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-title-large text-on-surface">
            {rows.length === 1 ? "1 review" : `${rows.length} reviews`}
          </h2>
          <p className="mt-1 text-body-medium text-on-surface-variant">
            Newest first. Open one to read the findings and the conversation
            together.
          </p>
        </div>

        <ButtonLink
          href={`/api/admin/export?prototypeId=${prototypeId}`}
          variant="outlined"
          icon={<DownloadIcon className="size-[18px]" />}
        >
          Download everything
        </ButtonLink>
      </div>

      <Card variant="outlined" className="overflow-hidden p-0">
        <ul className="divide-y divide-outline-variant">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/admin/${prototypeId}/reviews/${row.id}`}
                className="m3-state-layer flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-4 text-on-surface"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-title-medium">
                    {row.reviewerName}
                    {row.completedAt === null ? (
                      <span className="rounded-full border border-outline px-2 py-0.5 text-label-small text-on-surface-variant">
                        Not finished
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-body-small text-on-surface-variant">
                    {ROLE_LABELS[row.reviewerRole]} · {row.versionLabel} ·{" "}
                    {formatDate(row.startedAt)}
                  </p>
                </div>

                <span className="text-body-small text-on-surface-variant">
                  {row.findings === 0
                    ? "Nothing logged"
                    : `${row.findings} ${row.findings === 1 ? "finding" : "findings"}`}
                  {row.messages > 0
                    ? ` · ${row.messages} ${row.messages === 1 ? "message" : "messages"}`
                    : ""}
                </span>

                <ChevronRightIcon className="size-5 shrink-0 text-on-surface-variant" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
