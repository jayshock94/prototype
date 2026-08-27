import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getDb } from "@/db";
import { prototype, version } from "@/db/schema";
import { MAX_KNOWLEDGE_BASE_BYTES } from "@/lib/prototype-storage";
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

  // The knowledge base is stored on the version, not the prototype, so the
  // form needs whichever version is current.
  const [current] = await db
    .select({
      label: version.label,
      knowledgeBaseText: version.knowledgeBaseText,
    })
    .from(version)
    .where(and(eq(version.prototypeId, prototypeId), eq(version.isCurrent, true)))
    .limit(1);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <p className="text-label-medium text-on-surface-variant">{row.name}</p>
        <h1 className="text-headline-medium text-on-surface">Edit prototype</h1>
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
        initial={{
          name: row.name,
          ticket: row.ticket ?? "",
          description: row.description ?? "",
          // The form edits this as one-per-line text and the action parses it
          // back into an array, which is the same round trip the create form
          // makes.
          reviewerNames: row.reviewerNames.join("\n"),
          knowledgeBaseText: current?.knowledgeBaseText ?? "",
        }}
      />
    </div>
  );
}
