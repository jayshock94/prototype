import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { ArrowBackIcon, DownloadIcon } from "@/components/m3/icons";
import { SeverityBadge } from "@/components/m3/severity-badge";
import { getDb } from "@/db";
import { annotation, feedback, message, session, version } from "@/db/schema";
import { annotationImageUrl } from "@/lib/annotation";
import { SEVERITIES } from "@/lib/feedback";
import { ROLE_LABELS } from "@/lib/reviewer-role";

import { DispositionPicker } from "../../feedback/disposition-picker";

export const metadata: Metadata = { title: "Review · Admin" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * One visit, in full.
 *
 * Findings and conversation on one page, because the findings are the summary
 * and the conversation is the evidence -- "the totals were confusing" means one
 * thing on its own and something much more specific when you can read the four
 * messages that produced it.
 *
 * Findings first, worst first, because that is what gets acted on. The
 * conversation is reference material and sits underneath, which is the same
 * order the downloadable report uses.
 *
 * Triage works here as well as on the Feedback tab, using the same control. An
 * item read in context is exactly when you know what to do with it, and making
 * somebody go back to a different page to say so is how a decision gets lost.
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ prototypeId: string; sessionId: string }>;
}) {
  const { prototypeId, sessionId } = await params;
  if (!UUID.test(prototypeId) || !UUID.test(sessionId)) notFound();

  const db = getDb();

  // The join to version is the check that this session belongs to the
  // prototype in the URL, rather than trusting two ids that arrived together.
  const [visit] = await db
    .select({
      reviewerName: session.reviewerName,
      reviewerRole: session.reviewerRole,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      versionLabel: version.label,
      prototypeId: version.prototypeId,
    })
    .from(session)
    .innerJoin(version, eq(version.id, session.versionId))
    .where(eq(session.id, sessionId))
    .limit(1);

  if (!visit || visit.prototypeId !== prototypeId) notFound();

  const [findings, transcript] = await Promise.all([
    db
      .select({
        id: feedback.id,
        screenId: feedback.screenId,
        expected: feedback.expected,
        happened: feedback.happened,
        note: feedback.note,
        severity: feedback.severity,
        disposition: feedback.disposition,
        createdAt: feedback.createdAt,
        annotationId: annotation.id,
        annotationLabel: annotation.label,
        annotationBlobUrl: annotation.screenshotBlobUrl,
      })
      .from(feedback)
      .leftJoin(annotation, eq(annotation.id, feedback.annotationId))
      .where(eq(feedback.sessionId, sessionId))
      .orderBy(asc(feedback.createdAt)),
    db
      .select({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })
      .from(message)
      .where(eq(message.sessionId, sessionId))
      .orderBy(asc(message.createdAt)),
  ]);

  const ordered = [...findings].sort(
    (a, b) =>
      SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const download = `/api/admin/export?prototypeId=${prototypeId}&sessionId=${sessionId}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/${prototypeId}/reviews`}
          className="m3-state-layer -ml-2 inline-flex items-center gap-1 rounded-full py-1 pl-2 pr-3 text-label-large text-primary"
        >
          <ArrowBackIcon className="size-[18px]" />
          All reviews
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-title-large text-on-surface">{visit.reviewerName}</h2>
          <p className="mt-1 text-body-medium text-on-surface-variant">
            {ROLE_LABELS[visit.reviewerRole]} · {visit.versionLabel} ·{" "}
            {formatDateTime(visit.startedAt)}
          </p>
          <p className="mt-1 text-body-small text-on-surface-variant">
            {visit.completedAt
              ? `Finished ${formatDateTime(visit.completedAt)}.`
              : "Not finished — they may still be in there, or they closed the tab."}
          </p>
        </div>

        <ButtonLink
          href={download}
          variant="outlined"
          icon={<DownloadIcon className="size-[18px]" />}
        >
          Download this review
        </ButtonLink>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-title-medium text-on-surface">
          {ordered.length === 0
            ? "Nothing logged"
            : `${ordered.length} ${ordered.length === 1 ? "finding" : "findings"}`}
        </h3>

        {ordered.length === 0 ? (
          <Card variant="outlined" className="p-6">
            <p className="text-body-large text-on-surface-variant">
              They looked around and raised nothing. That is a result: either
              nothing got in their way, or nothing prompted them to say so.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {ordered.map((item) => (
              <li key={item.id}>
                <Card variant="outlined" className="p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <SeverityBadge severity={item.severity} />
                    {item.screenId ? (
                      <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-label-small text-on-surface-variant">
                        {item.screenId}
                      </span>
                    ) : null}
                    <span className="ml-auto">
                      <DispositionPicker
                        prototypeId={prototypeId}
                        feedbackId={item.id}
                        value={item.disposition}
                      />
                    </span>
                  </div>

                  {item.annotationId && item.annotationBlobUrl ? (
                    <figure className="mt-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={annotationImageUrl(item.annotationId)}
                        alt={item.annotationLabel ?? "What the reviewer pointed at"}
                        className="max-h-64 w-auto max-w-full rounded-sm border border-outline-variant bg-surface"
                      />
                      {item.annotationLabel ? (
                        <figcaption className="mt-1 text-body-small text-on-surface-variant">
                          {item.annotationLabel}
                        </figcaption>
                      ) : null}
                    </figure>
                  ) : null}

                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-body-medium sm:grid-cols-2">
                    {item.happened ? (
                      <Field label="What happened">{item.happened}</Field>
                    ) : null}
                    {item.expected ? (
                      <Field label="Expected">{item.expected}</Field>
                    ) : null}
                    {item.note ? (
                      <Field label="Note" wide>
                        {item.note}
                      </Field>
                    ) : null}
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-title-medium text-on-surface">Conversation</h3>

        {transcript.length === 0 ? (
          <Card variant="outlined" className="p-6">
            <p className="text-body-large text-on-surface-variant">
              No conversation. Either this prototype has no assistant, or they
              used the form and never typed anything.
            </p>
          </Card>
        ) : (
          <Card variant="outlined" className="flex flex-col gap-4 p-6">
            {transcript.map((turn) => (
              <div key={turn.id}>
                <p className="text-label-medium text-on-surface-variant">
                  {turn.role === "user" ? visit.reviewerName : "Assistant"}
                </p>
                {/*
                  The reviewer's own words are quoted with a rule down the side,
                  the assistant's are plain. Reading a transcript is mostly
                  hunting for what the person said, and a wall of alternating
                  paragraphs with only a name to tell them apart makes that
                  work.
                */}
                <p
                  className={[
                    "mt-1 whitespace-pre-line text-body-medium text-on-surface",
                    turn.role === "user"
                      ? "border-l-2 border-outline-variant pl-3"
                      : "",
                  ].join(" ")}
                >
                  {turn.content}
                </p>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-label-medium text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-on-surface">{children}</dd>
    </div>
  );
}
