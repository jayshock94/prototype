import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { OpenInNewIcon } from "@/components/m3/icons";
import { getDb } from "@/db";
import { prototype, version } from "@/db/schema";

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-label-medium text-on-surface-variant">
            {row.ticket ?? "No ticket"}
          </p>
          <h1 className="text-headline-medium text-on-surface">{row.name}</h1>
          <p className="mt-1 text-body-medium text-on-surface-variant">
            Added {formatDate(row.createdAt)}
          </p>
        </div>

        {current ? (
          <ButtonLink
            href={`/p/${current.id}`}
            target="_blank"
            rel="noreferrer"
            variant="filled"
            icon={<OpenInNewIcon className="size-[18px]" />}
          >
            Open {current.label}
          </ButtonLink>
        ) : null}
      </div>

      {row.description ? (
        <Card variant="filled" className="p-6">
          <p className="text-body-large whitespace-pre-line text-on-surface">
            {row.description}
          </p>
        </Card>
      ) : null}

      <Card variant="outlined" className="p-6">
        <dl className="grid gap-6 sm:grid-cols-2">
          <Detail label="Reviewer link">
            {/* TODO chunk 3: this link starts working once /r/ is built. */}
            <code className="text-body-medium break-all text-on-surface-variant">
              /r/{row.id}
            </code>
            <p className="mt-1 text-body-small text-on-surface-variant">
              Not built yet — arrives with the reviewer flow.
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
