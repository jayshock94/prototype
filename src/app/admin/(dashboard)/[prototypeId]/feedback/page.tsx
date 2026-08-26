import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { Card } from "@/components/m3/card";
import { ArrowBackIcon } from "@/components/m3/icons";
import { SeverityBadge } from "@/components/m3/severity-badge";
import { getDb } from "@/db";
import { feedback, prototype, session, version } from "@/db/schema";
import {
  SEVERITIES,
  SEVERITY_LABELS,
  isSeverity,
  summarise,
} from "@/lib/feedback";
import type { Severity } from "@/db/schema";

import { DispositionPicker } from "./disposition-picker";

export const metadata: Metadata = { title: "Feedback · Admin" };
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

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ prototypeId: string }>;
  searchParams: Promise<{ severity?: string; reviewer?: string }>;
}) {
  const { prototypeId } = await params;
  const filters = await searchParams;

  if (!UUID.test(prototypeId)) notFound();

  const db = getDb();

  const [row] = await db
    .select({ id: prototype.id, name: prototype.name })
    .from(prototype)
    .where(eq(prototype.id, prototypeId))
    .limit(1);

  if (!row) notFound();

  /*
   * Everything for this prototype in one query, filtered in memory afterwards.
   *
   * Filtering in SQL would be the reflex, but it would mean a second query just
   * to know which filter chips to offer and what each one would return. This is
   * one designer's review portal: a busy prototype has tens of feedback rows,
   * not tens of thousands. When that stops being true, push the WHERE down and
   * compute the facets with a GROUP BY.
   */
  const rows = await db
    .select({
      id: feedback.id,
      screenId: feedback.screenId,
      expected: feedback.expected,
      happened: feedback.happened,
      note: feedback.note,
      severity: feedback.severity,
      disposition: feedback.disposition,
      createdAt: feedback.createdAt,
      reviewerName: session.reviewerName,
      versionId: version.id,
      versionLabel: version.label,
      versionCreatedAt: version.createdAt,
    })
    .from(feedback)
    .innerJoin(session, eq(session.id, feedback.sessionId))
    .innerJoin(version, eq(version.id, session.versionId))
    .where(eq(version.prototypeId, prototypeId))
    .orderBy(desc(version.createdAt), desc(feedback.createdAt));

  const severityFilter = isSeverity(filters.severity) ? filters.severity : null;
  const reviewerFilter = filters.reviewer ?? null;

  const reviewers = [...new Set(rows.map((r) => r.reviewerName))].sort();

  const visible = rows.filter(
    (r) =>
      (!severityFilter || r.severity === severityFilter) &&
      (!reviewerFilter || r.reviewerName === reviewerFilter),
  );

  /*
   * Grouped by version, newest version first, and within a version worst first.
   *
   * The order matters in both directions and they are not the same order.
   * Versions run newest-first because feedback on the current version is what
   * is actionable; items inside a version run by severity because reading this
   * page is triage, and triage starts with what stops a release rather than
   * with whatever arrived most recently. Grouping before sorting is what keeps
   * a blocker on an old version from dragging that whole version to the top.
   */
  const byVersion = new Map<string, { label: string; items: typeof visible }>();
  for (const item of visible) {
    const group = byVersion.get(item.versionId);
    if (group) group.items.push(item);
    else byVersion.set(item.versionId, { label: item.versionLabel, items: [item] });
  }
  for (const group of byVersion.values()) {
    group.items.sort(
      (a, b) =>
        SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  /** Build a URL that toggles one filter and leaves the other alone. */
  function href(next: { severity?: Severity | null; reviewer?: string | null }) {
    const params = new URLSearchParams();
    const severity = next.severity === undefined ? severityFilter : next.severity;
    const reviewer = next.reviewer === undefined ? reviewerFilter : next.reviewer;
    if (severity) params.set("severity", severity);
    if (reviewer) params.set("reviewer", reviewer);
    const query = params.toString();
    return `/admin/${prototypeId}/feedback${query ? `?${query}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/${prototypeId}`}
          className="m3-state-layer -ml-2 inline-flex items-center gap-1 rounded-sm px-2 py-1 text-label-large text-on-surface-variant"
        >
          <ArrowBackIcon className="size-[18px]" />
          {row.name}
        </Link>
        <h1 className="mt-1 text-headline-medium text-on-surface">Feedback</h1>
        <p className="mt-1 text-body-medium text-on-surface-variant">
          {rows.length === 0
            ? "Nothing yet. It will appear here as reviewers work through the prototype."
            : `${rows.length} ${rows.length === 1 ? "item" : "items"} from ${reviewers.length} ${reviewers.length === 1 ? "reviewer" : "reviewers"}.`}
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-col gap-3">
          <FilterRow label="Severity">
            <FilterChip href={href({ severity: null })} active={!severityFilter}>
              All
            </FilterChip>
            {SEVERITIES.filter((s) => rows.some((r) => r.severity === s)).map((s) => (
              <FilterChip
                key={s}
                href={href({ severity: s })}
                active={severityFilter === s}
              >
                {SEVERITY_LABELS[s]}
                <Count n={rows.filter((r) => r.severity === s).length} />
              </FilterChip>
            ))}
          </FilterRow>

          {reviewers.length > 1 ? (
            <FilterRow label="Reviewer">
              <FilterChip href={href({ reviewer: null })} active={!reviewerFilter}>
                All
              </FilterChip>
              {reviewers.map((name) => (
                <FilterChip
                  key={name}
                  href={href({ reviewer: name })}
                  active={reviewerFilter === name}
                >
                  {name}
                  <Count n={rows.filter((r) => r.reviewerName === name).length} />
                </FilterChip>
              ))}
            </FilterRow>
          ) : null}
        </div>
      ) : null}

      {visible.length === 0 && rows.length > 0 ? (
        <Card variant="outlined" className="p-6">
          <p className="text-body-large text-on-surface-variant">
            Nothing matches those filters.
          </p>
        </Card>
      ) : null}

      {[...byVersion.entries()].map(([versionId, group]) => (
        <section key={versionId} className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-title-large text-on-surface">{group.label}</h2>
            <span className="text-body-small text-on-surface-variant">
              {group.items.length} {group.items.length === 1 ? "item" : "items"}
            </span>
          </div>

          <ul className="flex flex-col gap-3">
            {group.items.map((item) => (
              <li key={item.id}>
                <Card variant="outlined" className="p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <SeverityBadge severity={item.severity} />
                    <span className="text-label-large text-on-surface">
                      {item.reviewerName}
                    </span>
                    {item.screenId ? (
                      <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-label-small text-on-surface-variant">
                        {item.screenId}
                      </span>
                    ) : null}
                    <span className="text-body-small text-on-surface-variant">
                      {formatDate(item.createdAt)}
                    </span>

                    <span className="ml-auto">
                      <DispositionPicker
                        prototypeId={prototypeId}
                        feedbackId={item.id}
                        value={item.disposition}
                      />
                    </span>
                  </div>

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

                  {/* A row with no text at all should be impossible -- both
                      write paths reject it -- but an empty card would be a
                      mystery rather than a bug report, so say something. */}
                  {!item.happened && !item.expected && !item.note ? (
                    <p className="mt-3 text-body-medium text-on-surface-variant">
                      {summarise({ ...item })}
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
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
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-label-medium text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-on-surface">{children}</dd>
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-label-medium text-on-surface-variant">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * A filter chip as a link, not a button.
 *
 * Filters live entirely in the URL, so the page needs no client JavaScript to
 * filter, the back button works, and a filtered view can be sent to somebody
 * else as a link.
 */
function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={[
        "m3-state-layer inline-flex h-8 items-center gap-1 rounded-sm border px-3 text-label-large",
        active
          ? "border-transparent bg-secondary-container text-on-secondary-container"
          : "border-outline text-on-surface",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function Count({ n }: { n: number }) {
  return <span className="text-on-surface-variant">{n}</span>;
}
