/**
 * Turning one review session into something a reviewer can hand over.
 *
 * The point of this file is not the file format. It is that a reviewer who
 * screenshots things on their own has to write the description, remember what
 * they expected, and organise it before sending anything. Everything in here
 * exists because it is something a screenshot cannot carry:
 *
 *  - structure: severity, screen, expected against what happened
 *  - the conversation, which is where "what did you expect instead?" was
 *    already asked and answered
 *  - provenance: which prototype, which version, who, and when
 *
 * Two renderings of the same session, because there are two ways it actually
 * gets sent. The HTML is for attaching, and for printing to PDF. The Markdown
 * is for pasting into a ticket or a chat window without reformatting it.
 *
 * Screenshots are in, and they are in twice on purpose. The HTML carries each
 * one inline as a data URI, because the report has to open as an email
 * attachment on a laptop with no connection and an <img src="screenshots/..">
 * is a broken image the moment somebody forwards the HTML on its own. The
 * archive also holds the PNGs as real files, because a designer wants to drag
 * one into a ticket without extracting it from a base64 string.
 */

import "server-only";

import {
  DISPOSITION_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  type FeedbackItem,
} from "@/lib/feedback";
import type { Disposition, Severity } from "@/db/schema";

/** One screenshot, as it goes into the archive. */
export interface ExportShot {
  /** Path inside the archive, e.g. `screenshots/01-continue-button.png`. */
  path: string;
  /** What it is a picture of, in words. Becomes the alt text. */
  label: string;
  /**
   * The picture itself, or null when it was not fetched.
   *
   * Null is the ordinary case for `?format=md`, which produces text for
   * pasting into a ticket: downloading a dozen PNGs to render a string nobody
   * will see them in is work for nothing. The report still says a picture
   * exists, because "there is a screenshot of this in the download" is worth
   * knowing and silence is not.
   */
  bytes: Buffer | null;
}

export interface ExportItem extends FeedbackItem {
  createdAt: Date;
  /** The picture of what they pointed at, when they pointed at something. */
  shot?: ExportShot | null;
}

export interface ExportMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface ExportData {
  prototypeName: string;
  ticket: string | null;
  versionLabel: string;
  changedNote: string | null;
  reviewerName: string;
  startedAt: Date;
  completedAt: Date | null;
  items: ExportItem[];
  transcript: ExportMessage[];
}

/* --------------------------------------------------------------------------
 * Naming
 * ------------------------------------------------------------------------ */

/**
 * A filename fragment that survives every operating system and mail client.
 *
 * Accented letters are folded to ASCII rather than dropped, so "Renée" becomes
 * "renee" and not "ren". The archive itself handles UTF-8 names correctly, but
 * a file that has been through Outlook, Teams and someone's Downloads folder
 * has more chances to get mangled than is worth taking.
 */
export function slug(text: string): string {
  return (
    text
      .normalize("NFKD")
      // Strip the combining accents NFKD just split off, so "Renee" survives
      // where a blanket [^a-z0-9] filter would have left "ren".
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "review"
  );
}

/** `counteroffer-flow-v1-sam-patel-2026-08-27.zip` */
export function exportFileName(data: ExportData, now: Date): string {
  const day = now.toISOString().slice(0, 10);
  return [
    slug(data.prototypeName),
    slug(data.versionLabel),
    slug(data.reviewerName),
    day,
  ].join("-").concat(".zip");
}

/* --------------------------------------------------------------------------
 * Shared shaping
 * ------------------------------------------------------------------------ */

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Worst first. The designer reading this should meet the blockers first. */
function ordered(items: ExportItem[]): ExportItem[] {
  return [...items].sort(
    (a, b) =>
      SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

function countsBySeverity(items: ExportItem[]): Array<[Severity, number]> {
  return SEVERITIES.map(
    (s) => [s, items.filter((i) => i.severity === s).length] as [Severity, number],
  ).filter(([, n]) => n > 0);
}

/* --------------------------------------------------------------------------
 * HTML
 * ------------------------------------------------------------------------ */

/** Everything written into the document is escaped; none of it is trusted. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The report stylesheet.
 *
 * Inline, because the file has to work as an email attachment on a laptop with
 * no network. System fonts for the same reason -- a webfont would be either a
 * request to Google or half a megabyte of base64.
 *
 * Written for paper first. Severity tags keep their colour because that is the
 * one place colour is carrying information; everything else is near-black on
 * white so a printed copy does not cost a cartridge. `break-inside: avoid`
 * keeps an item from being split across two pages, which is the difference
 * between a document somebody reads and one they put down.
 */
const REPORT_CSS = `
:root {
  --ink: #1c1b1f;
  --muted: #49454f;
  --line: #cac4d0;
  --rule: #e7e0ec;
  --page: #ffffff;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 48px 40px 64px;
  background: var(--page);
  color: var(--ink);
  font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
  max-width: 44rem;
  margin-inline: auto;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
h1 { font-size: 26px; line-height: 1.2; margin: 0 0 4px; }
h2 {
  font-size: 13px; letter-spacing: .09em; text-transform: uppercase;
  color: var(--muted); margin: 40px 0 12px;
  padding-bottom: 6px; border-bottom: 1px solid var(--rule);
}
p { margin: 0 0 10px; }
.sub { color: var(--muted); margin: 0 0 24px; }

.meta {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 28px; margin: 0 0 8px;
  padding: 16px 18px; border: 1px solid var(--rule); border-radius: 10px;
}
.meta div { min-width: 0; }
.meta dt {
  font-size: 11px; letter-spacing: .07em; text-transform: uppercase;
  color: var(--muted); margin-bottom: 2px;
}
.meta dd { margin: 0; }

.tally { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 0; padding: 0; list-style: none; }
.tally li { display: flex; align-items: center; gap: 6px; }
.tally b { font-weight: 600; }

.tag {
  display: inline-block; padding: 2px 9px; border-radius: 999px;
  font-size: 11px; font-weight: 600; letter-spacing: .03em; white-space: nowrap;
}
.tag-blocker      { background: #b3261e; color: #fff; }
.tag-major        { background: #f9dedc; color: #410e0b; }
.tag-minor        { background: #e8def8; color: #1d192b; }
.tag-preference   { background: #f3edf7; color: #49454f; }
.tag-new_request  { background: #ffd8e4; color: #31111d; }

.item {
  border: 1px solid var(--line); border-radius: 10px;
  padding: 14px 16px; margin: 0 0 12px;
  break-inside: avoid; page-break-inside: avoid;
}
.item-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.item-where { font-weight: 600; }
.item-when { color: var(--muted); font-size: 13px; margin-left: auto; }
.item dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; }
.item dt {
  font-size: 11px; letter-spacing: .07em; text-transform: uppercase;
  color: var(--muted); padding-top: 3px;
}
.item dd { margin: 0; white-space: pre-wrap; }

.who { color: var(--muted); font-size: 13px; }
.disp {
  display: inline-block; padding: 2px 9px; border-radius: 999px;
  font-size: 11px; border: 1px solid var(--line); color: var(--muted);
  white-space: nowrap;
}
.review-head {
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  margin: 26px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--rule);
}
.review-head h3 { font-size: 16px; margin: 0; }

.shot { margin: 0 0 12px; }
.shot img {
  display: block; max-width: 100%; height: auto;
  border: 1px solid var(--line); border-radius: 6px;
}
.shot figcaption {
  color: var(--muted); font-size: 12px; margin-top: 5px;
}

.turn { margin: 0 0 14px; break-inside: avoid; page-break-inside: avoid; }
.turn-who {
  font-size: 11px; letter-spacing: .07em; text-transform: uppercase;
  color: var(--muted); margin-bottom: 3px;
}
.turn-said { margin: 0; white-space: pre-wrap; }
.turn-reviewer .turn-said { border-left: 3px solid var(--line); padding-left: 12px; }

.empty { color: var(--muted); font-style: italic; }
footer {
  margin-top: 44px; padding-top: 14px; border-top: 1px solid var(--rule);
  color: var(--muted); font-size: 12px;
}

@page { margin: 16mm; }
@media print {
  body { padding: 0; max-width: none; font-size: 11pt; }
  h2 { margin-top: 26px; }
  /* The transcript is reference material. Start it on its own sheet so the
     findings -- the part that gets acted on -- stay together. */
  .transcript { break-before: page; page-break-before: always; }
  .no-print { display: none; }
}
`.trim();

/**
 * How much base64 image the HTML file may carry.
 *
 * Inlining is not optional -- a report that loads its pictures from a folder is
 * a report with broken images the first time somebody forwards the HTML on its
 * own -- but base64 is a third bigger than the file it encodes, and a review
 * with forty screenshots would produce something no mail server will accept.
 * Past this point the pictures stay in the archive and the HTML says where to
 * find them, which is a worse report than one with the images in it and a much
 * better one than an attachment that bounces.
 */
const MAX_INLINE_IMAGE_BYTES = 12 * 1024 * 1024;

/**
 * The picture for one item, inline if there is room left.
 *
 * The caption is what the reviewer pointed at, not "screenshot": a picture with
 * a caption naming the thing in it can be read on its own, which is how these
 * end up pasted into a ticket without the paragraph they came from.
 */
function shotHtml(item: ExportItem, budget: { left: number }): string {
  const shot = item.shot;
  if (!shot) return "";

  if (!shot.bytes || shot.bytes.length > budget.left) {
    return `<figure class="shot"><figcaption>Screenshot: ${esc(shot.label)} — see <code>${esc(shot.path)}</code> in this archive.</figcaption></figure>`;
  }

  budget.left -= shot.bytes.length;

  return `<figure class="shot">
        <img src="data:image/png;base64,${shot.bytes.toString("base64")}" alt="${esc(shot.label)}">
        <figcaption>${esc(shot.label)}</figcaption>
      </figure>`;
}

export function buildReportHtml(data: ExportData, now: Date): string {
  const items = ordered(data.items);
  const counts = countsBySeverity(items);
  const budget = { left: MAX_INLINE_IMAGE_BYTES };

  const meta = [
    data.ticket ? ["Ticket", data.ticket] : null,
    ["Version", data.versionLabel],
    ["Reviewer", data.reviewerName],
    ["Reviewed", formatDateTime(data.startedAt)],
    data.completedAt ? ["Finished", formatDateTime(data.completedAt)] : null,
    data.changedNote ? ["What changed", data.changedNote] : null,
  ].filter(Boolean) as Array<[string, string]>;

  const itemsHtml =
    items.length === 0
      ? `<p class="empty">Nothing was raised during this review.</p>`
      : items
          .map(
            (item) => `
    <article class="item">
      <div class="item-head">
        <span class="tag tag-${item.severity}">${esc(SEVERITY_LABELS[item.severity])}</span>
        ${item.screenId ? `<span class="item-where">${esc(item.screenId)}</span>` : ""}
        <span class="item-when">${esc(formatDateTime(item.createdAt))}</span>
      </div>
      ${shotHtml(item, budget)}
      <dl>
        ${item.happened ? `<dt>Happened</dt><dd>${esc(item.happened)}</dd>` : ""}
        ${item.expected ? `<dt>Expected</dt><dd>${esc(item.expected)}</dd>` : ""}
        ${item.note ? `<dt>Note</dt><dd>${esc(item.note)}</dd>` : ""}
      </dl>
    </article>`,
          )
          .join("");

  const transcriptHtml =
    data.transcript.length === 0
      ? `<p class="empty">This reviewer did not use the assistant.</p>`
      : data.transcript
          .map(
            (turn) => `
    <div class="turn turn-${turn.role === "user" ? "reviewer" : "assistant"}">
      <p class="turn-who">${turn.role === "user" ? esc(data.reviewerName) : "Assistant"}</p>
      <p class="turn-said">${esc(turn.content)}</p>
    </div>`,
          )
          .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(data.prototypeName)} — review by ${esc(data.reviewerName)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>

<h1>${esc(data.prototypeName)}</h1>
<p class="sub">Review by ${esc(data.reviewerName)}</p>

<dl class="meta">
  ${meta.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("\n  ")}
</dl>

${
  counts.length > 0
    ? `<ul class="tally">${counts
        .map(
          ([severity, n]) =>
            `<li><span class="tag tag-${severity}">${esc(SEVERITY_LABELS[severity])}</span><b>${n}</b></li>`,
        )
        .join("")}</ul>`
    : ""
}

<h2>${items.length} ${items.length === 1 ? "finding" : "findings"}</h2>
${itemsHtml}

<section class="transcript">
  <h2>Conversation</h2>
  <p class="sub">What was said while reviewing, in full. This is the context behind the findings above.</p>
  ${transcriptHtml}
</section>

<footer>
  Exported ${esc(formatDateTime(now))} from the prototype review portal.
  To save this as a PDF, print the page and choose “Save as PDF” as the destination.
</footer>

</body>
</html>`;
}

/* --------------------------------------------------------------------------
 * Screenshots
 * ------------------------------------------------------------------------ */

/** How many screenshots one export will carry. Past this, the words remain. */
export const MAX_SHOTS = 60;

/** One feedback row, as far as collecting its screenshot is concerned. */
export interface ShotSource {
  id: string;
  screenId: string | null;
  annotationLabel: string | null;
  annotationScreenId: string | null;
  annotationBlobUrl: string | null;
}

/**
 * Read the screenshots a set of feedback rows point at, keyed by row id.
 *
 * Shared by the reviewer's own download and the admin's, because "which file
 * is this picture, and what is it a picture of" should not have two answers.
 *
 * Numbered in the order the rows arrive, so the filenames sort the way the
 * report reads, and named with the element's label because
 * `screenshots/03-continue-button.png` is a file somebody can find again next
 * week and `03.png` is not.
 *
 * `withBytes: false` collects the names without downloading anything. That is
 * what the paste-as-text report wants: it says a screenshot exists without
 * fetching a megabyte of PNG nobody will look at.
 */
export async function collectShots(
  rows: ShotSource[],
  {
    withBytes,
    read,
  }: {
    withBytes: boolean;
    /** How to fetch one blob. Injected so this file needs no storage import. */
    read: (blobUrl: string) => Promise<Buffer | null>;
  },
): Promise<Map<string, ExportShot>> {
  const wanted = rows.filter((row) => row.annotationBlobUrl).slice(0, MAX_SHOTS);

  const fetched = await Promise.all(
    wanted.map(async (row, index) => {
      const bytes = withBytes ? await read(row.annotationBlobUrl!) : null;
      // Only a fetch that was attempted and failed counts as missing. A report
      // that was never going to carry the picture still says it exists.
      if (withBytes && !bytes) return null;

      const where = row.annotationScreenId ?? row.screenId;
      const label = [row.annotationLabel ?? "the area they pointed at", where]
        .filter(Boolean)
        .join(" — ");

      return [
        row.id,
        {
          path: `screenshots/${String(index + 1).padStart(2, "0")}-${slug(
            row.annotationLabel ?? where ?? "reference",
          )}.png`,
          label,
          bytes,
        },
      ] as const;
    }),
  );

  return new Map(fetched.filter((entry) => entry !== null));
}

/* --------------------------------------------------------------------------
 * Markdown
 * ------------------------------------------------------------------------ */

/**
 * The same session as plain text.
 *
 * For the case the HTML does not serve: pasting into a ticket, a chat window
 * or an email body, where an attachment is one click too many and nobody opens
 * it anyway.
 */
export function buildReportMarkdown(
  data: ExportData,
  now: Date,
  /**
   * True when this Markdown is going into the archive beside a `screenshots/`
   * folder, so a relative image link resolves. The copy-to-clipboard button
   * passes false: pasting `![](screenshots/01.png)` into a ticket produces a
   * broken image, and a line saying a picture exists is more use than one that
   * looks like a mistake.
   */
  options: { archive: boolean } = { archive: false },
): string {
  const items = ordered(data.items);
  const counts = countsBySeverity(items);

  const lines: string[] = [
    `# ${data.prototypeName} — review by ${data.reviewerName}`,
    "",
    ...[
      data.ticket ? `- **Ticket:** ${data.ticket}` : null,
      `- **Version:** ${data.versionLabel}`,
      `- **Reviewer:** ${data.reviewerName}`,
      `- **Reviewed:** ${formatDateTime(data.startedAt)}`,
      data.completedAt ? `- **Finished:** ${formatDateTime(data.completedAt)}` : null,
      data.changedNote ? `- **What changed:** ${data.changedNote}` : null,
    ].filter(Boolean) as string[],
    "",
  ];

  if (counts.length > 0) {
    lines.push(
      counts.map(([s, n]) => `${SEVERITY_LABELS[s]}: ${n}`).join(" · "),
      "",
    );
  }

  lines.push(`## ${items.length} ${items.length === 1 ? "finding" : "findings"}`, "");

  if (items.length === 0) {
    lines.push("_Nothing was raised during this review._", "");
  } else {
    for (const item of items) {
      const where = item.screenId ? ` — ${item.screenId}` : "";
      lines.push(`### ${SEVERITY_LABELS[item.severity]}${where}`, "");
      if (item.shot) {
        lines.push(
          options.archive
            ? `![${item.shot.label}](${item.shot.path})`
            : `_Pointed at: ${item.shot.label}. There is a screenshot of it in the downloaded file._`,
          "",
        );
      }
      if (item.happened) lines.push(`**Happened:** ${item.happened}`, "");
      if (item.expected) lines.push(`**Expected:** ${item.expected}`, "");
      if (item.note) lines.push(`**Note:** ${item.note}`, "");
    }
  }

  lines.push("## Conversation", "");

  if (data.transcript.length === 0) {
    lines.push("_This reviewer did not use the assistant._", "");
  } else {
    for (const turn of data.transcript) {
      const who = turn.role === "user" ? data.reviewerName : "Assistant";
      lines.push(`**${who}:** ${turn.content}`, "");
    }
  }

  lines.push("---", "", `Exported ${formatDateTime(now)} from the prototype review portal.`);

  return `${lines.join("\n")}\n`;
}

/* --------------------------------------------------------------------------
 * The whole prototype, for the designer
 *
 * The reviewer's report answers "what did I say?". This one answers "what did
 * everybody say?", which is a different document and not the same one repeated
 * four times. Findings from every review are pooled and ordered worst-first
 * inside each version, each carrying the name of whoever said it; the
 * conversations follow at the back as reference.
 *
 * It reuses the same stylesheet, so the file Jay downloads and the file a
 * reviewer downloads look like two pages of one thing rather than two
 * documents from two different applications.
 * ------------------------------------------------------------------------ */

export interface SummaryItem extends ExportItem {
  reviewerName: string;
  versionLabel: string;
  /** Jay's own triage. Absent on anything he has not looked at yet. */
  disposition: Disposition | null;
}

export interface SummaryReview {
  reviewerName: string;
  /** The role they picked, already worded for a person. */
  role: string;
  versionLabel: string;
  startedAt: Date;
  completedAt: Date | null;
  transcript: ExportMessage[];
  findings: number;
}

export interface SummaryData {
  prototypeName: string;
  ticket: string | null;
  description: string | null;
  reviews: SummaryReview[];
  items: SummaryItem[];
}

/** `counteroffer-flow-all-feedback-2026-08-27.zip` */
export function summaryFileName(data: SummaryData, now: Date): string {
  return [slug(data.prototypeName), "all-feedback", now.toISOString().slice(0, 10)]
    .join("-")
    .concat(".zip");
}

/**
 * Findings grouped by version, in the order the versions were given.
 *
 * Grouping happens before sorting, deliberately, and it is the same rule the
 * admin feedback page follows: sort first and a blocker on a version nobody
 * ships any more drags that whole version to the top of the page.
 */
function byVersion(items: SummaryItem[]): Array<[string, SummaryItem[]]> {
  const groups = new Map<string, SummaryItem[]>();
  for (const item of items) {
    const group = groups.get(item.versionLabel);
    if (group) group.push(item);
    else groups.set(item.versionLabel, [item]);
  }
  return [...groups.entries()].map(([label, group]) => [
    label,
    [...group].sort(
      (a, b) =>
        SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    ),
  ]);
}

export function buildSummaryHtml(data: SummaryData, now: Date): string {
  const budget = { left: MAX_INLINE_IMAGE_BYTES };
  const counts = countsBySeverity(data.items);
  const reviewers = [...new Set(data.reviews.map((r) => r.reviewerName))];

  const meta = [
    data.ticket ? ["Ticket", data.ticket] : null,
    [
      "Reviews",
      `${data.reviews.length} from ${reviewers.length} ${
        reviewers.length === 1 ? "person" : "people"
      }`,
    ],
    reviewers.length > 0 ? ["Reviewers", reviewers.join(", ")] : null,
    ["Findings", String(data.items.length)],
  ].filter(Boolean) as Array<[string, string]>;

  const groups = byVersion(data.items);

  const findingsHtml =
    data.items.length === 0
      ? `<p class="empty">Nothing has been raised yet.</p>`
      : groups
          .map(
            ([label, items]) => `
  <h2>${esc(label)} — ${items.length} ${items.length === 1 ? "finding" : "findings"}</h2>
  ${items
    .map(
      (item) => `
    <article class="item">
      <div class="item-head">
        <span class="tag tag-${item.severity}">${esc(SEVERITY_LABELS[item.severity])}</span>
        ${item.screenId ? `<span class="item-where">${esc(item.screenId)}</span>` : ""}
        ${
          item.disposition
            ? `<span class="disp">${esc(DISPOSITION_LABELS[item.disposition])}</span>`
            : ""
        }
        <span class="item-when">${esc(item.reviewerName)} · ${esc(formatDateTime(item.createdAt))}</span>
      </div>
      ${shotHtml(item, budget)}
      <dl>
        ${item.happened ? `<dt>Happened</dt><dd>${esc(item.happened)}</dd>` : ""}
        ${item.expected ? `<dt>Expected</dt><dd>${esc(item.expected)}</dd>` : ""}
        ${item.note ? `<dt>Note</dt><dd>${esc(item.note)}</dd>` : ""}
      </dl>
    </article>`,
    )
    .join("")}`,
          )
          .join("");

  const conversationsHtml =
    data.reviews.every((review) => review.transcript.length === 0)
      ? `<p class="empty">No conversations. These reviews used the form rather than the assistant.</p>`
      : data.reviews
          .filter((review) => review.transcript.length > 0)
          .map(
            (review) => `
  <div class="review-head">
    <h3>${esc(review.reviewerName)}</h3>
    <span class="who">${esc(review.role)} · ${esc(review.versionLabel)} · ${esc(formatDateTime(review.startedAt))}</span>
  </div>
  ${review.transcript
    .map(
      (turn) => `
    <div class="turn turn-${turn.role === "user" ? "reviewer" : "assistant"}">
      <p class="turn-who">${turn.role === "user" ? esc(review.reviewerName) : "Assistant"}</p>
      <p class="turn-said">${esc(turn.content)}</p>
    </div>`,
    )
    .join("")}`,
          )
          .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(data.prototypeName)} — all feedback</title>
<style>${REPORT_CSS}</style>
</head>
<body>

<h1>${esc(data.prototypeName)}</h1>
<p class="sub">Everything reviewers have said, in one place</p>

<dl class="meta">
  ${meta.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("\n  ")}
</dl>

${
  counts.length > 0
    ? `<ul class="tally">${counts
        .map(
          ([severity, n]) =>
            `<li><span class="tag tag-${severity}">${esc(SEVERITY_LABELS[severity])}</span><b>${n}</b></li>`,
        )
        .join("")}</ul>`
    : ""
}

${data.description ? `<h2>What this is</h2><p>${esc(data.description)}</p>` : ""}

${findingsHtml}

<section class="transcript">
  <h2>Conversations</h2>
  <p class="sub">What was said while reviewing. This is the context behind the findings above.</p>
  ${conversationsHtml}
</section>

<footer>
  Exported ${esc(formatDateTime(now))} from the prototype review portal.
  To save this as a PDF, print the page and choose “Save as PDF” as the destination.
</footer>

</body>
</html>`;
}

export function buildSummaryMarkdown(
  data: SummaryData,
  now: Date,
  options: { archive: boolean } = { archive: false },
): string {
  const reviewers = [...new Set(data.reviews.map((r) => r.reviewerName))];
  const counts = countsBySeverity(data.items);

  const lines: string[] = [
    `# ${data.prototypeName} — all feedback`,
    "",
    ...([
      data.ticket ? `- **Ticket:** ${data.ticket}` : null,
      `- **Reviews:** ${data.reviews.length} from ${reviewers.length} ${
        reviewers.length === 1 ? "person" : "people"
      }`,
      reviewers.length > 0 ? `- **Reviewers:** ${reviewers.join(", ")}` : null,
      `- **Findings:** ${data.items.length}`,
    ].filter(Boolean) as string[]),
    "",
  ];

  if (counts.length > 0) {
    lines.push(counts.map(([s, n]) => `${SEVERITY_LABELS[s]}: ${n}`).join(" · "), "");
  }

  if (data.items.length === 0) {
    lines.push("_Nothing has been raised yet._", "");
  } else {
    for (const [label, items] of byVersion(data.items)) {
      lines.push(`## ${label} — ${items.length} ${items.length === 1 ? "finding" : "findings"}`, "");
      for (const item of items) {
        const where = item.screenId ? ` — ${item.screenId}` : "";
        const triaged = item.disposition
          ? ` (${DISPOSITION_LABELS[item.disposition]})`
          : "";
        lines.push(`### ${SEVERITY_LABELS[item.severity]}${where}${triaged}`, "");
        lines.push(`_${item.reviewerName}, ${formatDateTime(item.createdAt)}_`, "");
        if (item.shot) {
          lines.push(
            options.archive
              ? `![${item.shot.label}](${item.shot.path})`
              : `_Pointed at: ${item.shot.label}. There is a screenshot of it in the downloaded file._`,
            "",
          );
        }
        if (item.happened) lines.push(`**Happened:** ${item.happened}`, "");
        if (item.expected) lines.push(`**Expected:** ${item.expected}`, "");
        if (item.note) lines.push(`**Note:** ${item.note}`, "");
      }
    }
  }

  lines.push("## Conversations", "");

  const talking = data.reviews.filter((review) => review.transcript.length > 0);
  if (talking.length === 0) {
    lines.push("_No conversations. These reviews used the form rather than the assistant._", "");
  } else {
    for (const review of talking) {
      lines.push(
        `### ${review.reviewerName} — ${review.versionLabel}`,
        "",
        `_${review.role}, ${formatDateTime(review.startedAt)}_`,
        "",
      );
      for (const turn of review.transcript) {
        const who = turn.role === "user" ? review.reviewerName : "Assistant";
        lines.push(`**${who}:** ${turn.content}`, "");
      }
    }
  }

  lines.push("---", "", `Exported ${formatDateTime(now)} from the prototype review portal.`);

  return `${lines.join("\n")}\n`;
}
