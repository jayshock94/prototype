import { and, count, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/m3/button";
import { ArrowBackIcon, OpenInNewIcon } from "@/components/m3/icons";
import { Tabs } from "@/components/m3/tabs";
import { getDb } from "@/db";
import { feedback, prototype, session, version } from "@/db/schema";

/**
 * The frame around everything to do with one prototype.
 *
 * Before this there was no way out of a prototype except the browser's back
 * button, and no way to tell that Edit and Feedback were two views of the same
 * thing rather than two unrelated screens. Three pages each drew their own
 * heading, or forgot to.
 *
 * So the name, the way back, and the tabs live here once and every page under
 * this folder gets them. A page added later inherits the navigation by
 * existing, which is the point of putting it in a layout rather than in a
 * component each page has to remember to render.
 *
 * The two numbers on the tabs are deliberately different kinds. Reviews shows
 * how many there are; Feedback shows how many are *untriaged*, because a badge
 * that is always lit stops meaning anything and the only number worth walking
 * across the room for is the one that goes away when you have dealt with it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export default async function PrototypeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ prototypeId: string }>;
}) {
  const { prototypeId } = await params;
  if (!UUID.test(prototypeId)) notFound();

  const db = getDb();

  const [row] = await db
    .select({
      id: prototype.id,
      name: prototype.name,
      ticket: prototype.ticket,
      currentVersionId: version.id,
      currentVersionLabel: version.label,
    })
    .from(prototype)
    .leftJoin(
      version,
      and(eq(version.prototypeId, prototype.id), eq(version.isCurrent, true)),
    )
    .where(eq(prototype.id, prototypeId))
    .limit(1);

  if (!row) notFound();

  // Both counts in one query. They come from the same join, and two round
  // trips on every page of a section is two too many.
  const [tally] = await db
    .select({
      reviews: sql<number>`count(distinct ${session.id})::int`,
      /*
       * Untriaged findings, and the `feedback.id is not null` half is the
       * whole trick.
       *
       * The join to feedback has to be a LEFT join or a review that logged
       * nothing would drop out of the review count. That means a session with
       * no feedback still produces one row here, with a null disposition --
       * so testing the disposition alone counts every empty review as an
       * untriaged finding. It read "17 to triage" on a prototype with four
       * findings, which is exactly the sort of number that teaches somebody
       * to ignore the badge.
       */
      untriaged: count(
        sql`case
              when ${feedback.id} is not null and ${feedback.disposition} is null
              then 1
            end`,
      ),
    })
    .from(session)
    .innerJoin(version, eq(version.id, session.versionId))
    .leftJoin(feedback, eq(feedback.sessionId, session.id))
    .where(eq(version.prototypeId, prototypeId));

  const base = `/admin/${row.id}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <Link
            href="/admin"
            className="m3-state-layer -ml-2 inline-flex items-center gap-1 rounded-full py-1 pl-2 pr-3 text-label-large text-primary"
          >
            <ArrowBackIcon className="size-[18px]" />
            Prototypes
          </Link>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-label-medium text-on-surface-variant">
              {row.ticket ?? "No ticket"}
            </p>
            <h1 className="text-headline-medium text-on-surface">{row.name}</h1>
          </div>

          {/* Opening the prototype is the thing you want from any of these
              tabs, so it sits in the frame rather than on one page. */}
          {row.currentVersionId ? (
            <ButtonLink
              href={`/p/${row.currentVersionId}`}
              target="_blank"
              rel="noreferrer"
              variant="outlined"
              icon={<OpenInNewIcon className="size-[18px]" />}
            >
              Open {row.currentVersionLabel}
            </ButtonLink>
          ) : null}
        </div>

        <Tabs
          items={[
            { href: base, label: "Overview" },
            {
              href: `${base}/reviews`,
              label: "Reviews",
              badge: tally?.reviews ?? 0,
            },
            {
              href: `${base}/feedback`,
              label: "Feedback",
              badge: tally?.untriaged ?? 0,
            },
            { href: `${base}/edit`, label: "Settings" },
          ]}
        />
      </div>

      {children}
    </div>
  );
}
