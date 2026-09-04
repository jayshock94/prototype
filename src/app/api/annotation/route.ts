/**
 * Recording what the reviewer pointed at.
 *
 * The browser takes the picture -- see src/lib/element-capture.ts for why it
 * has to be the browser -- and posts it here with the name of the element, the
 * screen it was on, and a selector for finding it again. This route stores the
 * PNG and writes the annotation row.
 *
 * It writes nothing to the feedback table. An annotation is a reference, not a
 * finding: the reviewer points at something first and says what is wrong about
 * it afterwards, and the next item they save picks the reference up. Pointing
 * at something and then saying nothing is allowed, and costs a row.
 *
 * multipart/form-data rather than JSON, because the body is mostly a PNG and
 * base64 in a JSON field would make it a third larger for no gain.
 */

import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { annotation } from "@/db/schema";
import { annotationImageUrl } from "@/lib/annotation";
import {
  MAX_ANNOTATION_IMAGE_BYTES,
  putAnnotationImage,
} from "@/lib/prototype-storage";
import { currentReviewerSession } from "@/lib/reviewer-session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Longest an element name or selector may be. Both are generated, not typed. */
const MAX_LABEL_CHARS = 120;
const MAX_SELECTOR_CHARS = 500;

/**
 * How many references one reviewer may make in one session.
 *
 * Not a design limit -- nobody points at four hundred things -- but each one
 * is a file in the store, and a route that writes a blob per request wants a
 * ceiling that is not "however many times the button is pressed".
 */
const MAX_PER_SESSION = 200;

/** The first eight bytes of every PNG. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function text(value: FormDataEntryValue | null, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const prototypeId = String(form.get("prototypeId") ?? "");
  if (!UUID.test(prototypeId)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const reviewer = await currentReviewerSession(prototypeId);
  if (!reviewer) {
    return NextResponse.json({ error: "No review session." }, { status: 401 });
  }

  const image = form.get("image");
  if (!(image instanceof Blob) || image.size === 0) {
    return NextResponse.json({ error: "No picture was sent." }, { status: 400 });
  }
  if (image.size > MAX_ANNOTATION_IMAGE_BYTES) {
    return NextResponse.json({ error: "That picture is too big." }, { status: 413 });
  }

  const bytes = Buffer.from(await image.arrayBuffer());

  // The content type is whatever the browser said it was, so the bytes are
  // checked instead. Storing something that is not a PNG under an image
  // content type is how a file upload becomes an interesting afternoon.
  const isPng =
    bytes.length > PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
  if (!isPng) {
    return NextResponse.json({ error: "That is not a PNG." }, { status: 400 });
  }

  const db = getDb();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(annotation)
    .where(eq(annotation.sessionId, reviewer.sessionId));

  if (count >= MAX_PER_SESSION) {
    return NextResponse.json(
      { error: "That is a lot of references for one review." },
      { status: 429 },
    );
  }

  // The blob goes in first. A row pointing at a file that was never written
  // would show the reviewer a broken picture; a file with no row pointing at
  // it is invisible and costs a few hundred kilobytes.
  let screenshotBlobUrl: string;
  try {
    screenshotBlobUrl = await putAnnotationImage({
      sessionId: reviewer.sessionId,
      data: bytes,
    });
  } catch {
    return NextResponse.json(
      { error: "The picture could not be stored." },
      { status: 502 },
    );
  }

  const [row] = await db
    .insert(annotation)
    .values({
      sessionId: reviewer.sessionId,
      // "select" is the kind for pointing at an element, as opposed to
      // dropping a pin at a coordinate or drawing on the screen.
      kind: "select",
      screenId: text(form.get("screenId"), MAX_LABEL_CHARS),
      label: text(form.get("label"), MAX_LABEL_CHARS),
      cssSelector: text(form.get("selector"), MAX_SELECTOR_CHARS),
      coordsJson: readRect(form.get("rect")),
      screenshotBlobUrl,
    })
    .returning({
      id: annotation.id,
      screenId: annotation.screenId,
      label: annotation.label,
    });

  return NextResponse.json({
    annotation: {
      id: row.id,
      screenId: row.screenId,
      label: row.label,
      // Never the Blob URL. That one is private and would not load anyway;
      // this is the route that checks who is asking.
      imageUrl: annotationImageUrl(row.id),
    },
  });
}

/**
 * Where the element sat, if the browser sent something sensible.
 *
 * Nothing reads this yet. It is stored because it is free to store now and
 * impossible to recover later: re-finding an element from a selector needs
 * somewhere to check the answer against, and that is the next chunk's problem.
 */
function readRect(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const numbers = ["x", "y", "width", "height"].map((key) => parsed[key]);
    if (!numbers.every((n) => typeof n === "number" && Number.isFinite(n))) {
      return null;
    }
    const [x, y, width, height] = numbers as number[];
    return { rect: { x, y, width, height } };
  } catch {
    return null;
  }
}
