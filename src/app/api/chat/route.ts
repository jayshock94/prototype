/**
 * The reviewer assistant.
 *
 * Everything about Claude happens here, on the server. The API key is read
 * from the environment in this file and nowhere else, so it never reaches the
 * browser -- the browser only ever POSTs a message and reads back a stream.
 *
 * Since chunk 5 the assistant can also record feedback, using the
 * record_feedback tool. That is why the response is a stream of JSON events
 * rather than plain text: a turn can produce prose and rows in the feedback
 * table, and the panel has to show both as they happen.
 */

import Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import {
  criterion,
  feedback,
  message,
  notBuilt,
  prototype,
  session,
  task,
  version,
} from "@/db/schema";
import { buildSystemPrompt } from "@/lib/assistant-context";
import { isAssistantOff } from "@/lib/briefing";
import { anthropicApiKey, hasAnthropicApiKey } from "@/lib/env";
import {
  cleanField,
  isSeverity,
  type FeedbackDraft,
} from "@/lib/feedback";
import { PROPOSE_FEEDBACK, proposeFeedbackTool } from "@/lib/feedback-tool";
import {
  hasValidPass,
  passCookieName,
  readSessionId,
  sessionCookieName,
} from "@/lib/reviewer-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * How much of the conversation to send back with each message.
 *
 * The API is stateless, so memory means resending history. Twenty messages is
 * roughly ten exchanges -- long enough that a reviewer can say "and that other
 * screen?" and be understood, short enough that a long session does not grow
 * the cost of every message without limit.
 *
 * TUNE HERE: raise it if the assistant starts losing the thread of long
 * reviews; lower it if cost per message climbs. Above roughly a hundred,
 * prefer server-side compaction over a bigger window.
 */
const HISTORY_LIMIT = 20;

/**
 * Headroom for one reply, not a target. Answers should be two or three
 * sentences; this only stops a runaway. Raise it if replies get truncated.
 */
const MAX_REPLY_TOKENS = 4096;

/** Guards against a pathological paste rather than trimming normal messages. */
const MAX_MESSAGE_CHARS = 4000;

/**
 * How many times one message may go round the record-then-continue loop.
 *
 * A reviewer raising four problems in one message is normal and takes one
 * round, because Claude can call the tool four times in a single turn. More
 * than a handful of rounds means something has gone wrong, and this stops it
 * costing money while it does.
 */
const MAX_TOOL_ROUNDS = 4;

export async function POST(request: Request) {
  if (!hasAnthropicApiKey()) {
    return NextResponse.json(
      {
        error:
          "The assistant is not configured on the server. ANTHROPIC_API_KEY is missing.",
      },
      { status: 503 },
    );
  }

  let payload: { prototypeId?: unknown; message?: unknown; opening?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const prototypeId = String(payload.prototypeId ?? "");
  const text = String(payload.message ?? "").trim();

  /**
   * The assistant speaking first.
   *
   * prompts/assistant.md opens the session in four lines, which means the
   * first turn has no reviewer message to answer. The panel asks for one of
   * these when it loads into an empty conversation.
   */
  const opening = payload.opening === true;

  if (!UUID.test(prototypeId)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!opening) {
    if (!text) {
      return NextResponse.json({ error: "Say something first." }, { status: 400 });
    }
    if (text.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: "That message is too long." }, { status: 400 });
    }
  }

  // --- Who is asking -------------------------------------------------------
  // The same two cookies the review page requires. Checked again here because
  // an API route can be called directly, without the page.
  const store = await cookies();

  const passed = await hasValidPass(
    store.get(passCookieName(prototypeId))?.value,
    prototypeId,
  );
  if (!passed) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const sessionId = await readSessionId(
    store.get(sessionCookieName(prototypeId))?.value,
    prototypeId,
  );
  if (!sessionId) {
    return NextResponse.json({ error: "No review session." }, { status: 401 });
  }

  const db = getDb();

  // --- What this prototype is ---------------------------------------------
  const [context] = await db
    .select({
      versionId: version.id,
      versionLabel: version.label,
      knowledgeBaseText: version.knowledgeBaseText,
      scenario: version.scenario,
      name: prototype.name,
      description: prototype.description,
      mode: prototype.mode,
      reviewerName: session.reviewerName,
      reviewerRole: session.reviewerRole,
    })
    .from(session)
    .innerJoin(version, eq(version.id, session.versionId))
    .innerJoin(prototype, eq(prototype.id, version.prototypeId))
    .where(and(eq(session.id, sessionId), eq(prototype.id, prototypeId)))
    .limit(1);

  // The session must belong to this prototype. A cookie naming someone else's
  // session is not a way into their conversation.
  if (!context) {
    return NextResponse.json({ error: "No review session." }, { status: 401 });
  }

  /*
   * A prototype with the assistant off has no assistant, and that has to be
   * true here rather than only in the panel. The reviewer is served a form
   * instead of a chat, so nothing in the browser would call this -- but a route
   * that can be called directly has to enforce the setting itself, or "no
   * requests are ever made to Anthropic" is a claim about the UI rather than
   * about the application.
   */
  if (isAssistantOff(context.mode)) {
    return NextResponse.json(
      { error: "This prototype has no assistant." },
      { status: 404 },
    );
  }

  // The briefing for this version: what is deliberately missing, what the
  // reviewer can be asked to try, and what the ticket promised. Fetched
  // together because none of them depends on the others, and ordered by
  // sort_order so the assistant sees them in the order they were written.
  const [notBuiltRows, taskRows, criterionRows] = await Promise.all([
    db
      .select({ text: notBuilt.text })
      .from(notBuilt)
      .where(eq(notBuilt.versionId, context.versionId))
      .orderBy(asc(notBuilt.sortOrder)),
    db
      .select({ goal: task.goal, successState: task.successState })
      .from(task)
      .where(eq(task.versionId, context.versionId))
      .orderBy(asc(task.sortOrder)),
    db
      .select({
        ref: criterion.ref,
        text: criterion.text,
        verifiableInPrototype: criterion.verifiableInPrototype,
      })
      .from(criterion)
      .where(eq(criterion.versionId, context.versionId))
      .orderBy(asc(criterion.sortOrder)),
  ]);

  // Everything already recorded this visit. This goes into the system prompt
  // so Claude does not log the same complaint twice when a reviewer circles
  // back to it, and so it can answer "what have I flagged so far?".
  const alreadyRecorded = await db
    .select({
      severity: feedback.severity,
      screenId: feedback.screenId,
      happened: feedback.happened,
      expected: feedback.expected,
      note: feedback.note,
    })
    .from(feedback)
    .where(eq(feedback.sessionId, sessionId))
    .orderBy(feedback.createdAt);

  const systemPrompt = await buildSystemPrompt({
    name: context.name,
    description: context.description,
    versionLabel: context.versionLabel,
    knowledgeBaseText: context.knowledgeBaseText,
    notBuilt: notBuiltRows.map((r) => r.text),
    mode: context.mode,
    scenario: context.scenario,
    reviewerName: context.reviewerName,
    reviewerRole: context.reviewerRole,
    tasks: taskRows,
    criteria: criterionRows,
    recorded: alreadyRecorded.map((r) => ({
      severity: r.severity,
      screenId: r.screenId,
      happened: r.happened,
      expected: r.expected,
      note: r.note,
    })),
  });

  // --- Conversation so far -------------------------------------------------
  // Newest first, capped, then reversed: the tail of the conversation, in
  // order. Taking the oldest N instead would freeze the assistant's memory at
  // the start of the review.
  const recent = await db
    .select({ role: message.role, content: message.content })
    .from(message)
    .where(eq(message.sessionId, sessionId))
    .orderBy(desc(message.createdAt))
    .limit(HISTORY_LIMIT);

  const history: Anthropic.MessageParam[] = recent
    .reverse()
    .map((row) => ({ role: row.role, content: row.content }));

  /*
   * An opening is only an opening once. If anything has already been said in
   * this session, a request claiming otherwise is a stale tab or a reload
   * racing itself, and answering it would put a second greeting into the
   * middle of a conversation.
   */
  if (opening && history.length > 0) {
    return NextResponse.json({ error: "Already started." }, { status: 409 });
  }

  /*
   * The turn the model is answering.
   *
   * For an opening there is no reviewer message, so it gets a stage direction
   * instead. That direction is never written to the transcript and never shown
   * to anyone: the reviewer sees a conversation that begins with the assistant
   * talking, which is the point.
   */
  const turn = opening
    ? "[The reviewer has just opened the prototype and has not said anything yet. Open the session, following the Opening section of your instructions. Do not mention this note.]"
    : text;

  // Persist the reviewer's message before calling out, so it is not lost if
  // the API call fails. An opening has no reviewer message to persist.
  if (!opening) {
    await db.insert(message).values({ sessionId, role: "user", content: text });
  }

  const client = new Anthropic({ apiKey: anthropicApiKey() });

  const encoder = new TextEncoder();

  /**
   * Turn a tool call into a draft the reviewer can look at.
   *
   * Nothing is written here. prompts/assistant.md is explicit that a reviewer
   * confirms before anything is saved, so this validates the call, gives it an
   * id the browser can key on, and hands it back. The Save button on the card
   * is what writes a row, through /api/feedback, which validates it all over
   * again -- a draft that reaches the database has been checked twice and
   * agreed to once.
   *
   * Everything in it is untrusted: the fields come from a model, so they get
   * the same trimming as anything typed into a form. An unusable call returns
   * null and is reported back to Claude as an error rather than becoming a
   * card with nothing in it.
   */
  function propose(input: unknown): FeedbackDraft | null {
    const raw = (input ?? {}) as Record<string, unknown>;

    const happened = cleanField(raw.happened);
    const expected = cleanField(raw.expected);
    const note = cleanField(raw.note);

    // A draft with nothing in any of the three text fields says nothing to
    // anybody, so refuse it rather than showing the reviewer an empty card.
    if (!happened && !expected && !note) return null;

    return {
      // Not a database id -- there is no row yet. It exists so the panel can
      // key the card and so Save knows which draft it is saving.
      draftId: crypto.randomUUID(),
      screenId: cleanField(raw.screen_id),
      happened,
      expected,
      note,
      severity: isSeverity(raw.severity) ? raw.severity : "minor",
    };
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Everything the assistant said this turn, prose only, for the
      // transcript. Tool calls become draft cards instead, and only become
      // rows if the reviewer saves them.
      let reply = "";
      let closed = false;

      /**
       * One newline-delimited JSON object per event.
       *
       * Plain text was enough in chunk 4, when the only thing coming back was
       * prose. Now a turn can also produce feedback drafts, and the panel needs
       * to tell them apart. Text chunks are JSON-encoded, so a newline inside
       * one cannot be mistaken for the end of an event.
       */
      function emit(event: { t: "text"; v: string } | { t: "draft"; v: FeedbackDraft }) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The reviewer navigated away mid-answer; there is nobody to tell.
          closed = true;
        }
      }

      try {
        // The running turn-by-turn conversation for *this* request. It grows
        // as tool calls happen, and is thrown away afterwards -- the durable
        // record is the message table and the feedback rows.
        const conversation: Anthropic.MessageParam[] = [
          ...history,
          { role: "user", content: turn },
        ];

        for (let round = 0; ; round += 1) {
          // A turn that recorded something comes back for a second round and
          // keeps talking. Live, the panel has already started a fresh bubble
          // under the receipt -- but the transcript stores the whole turn as
          // one row, and without this the two halves are saved run together
          // ("That should not happen.Logged as a blocker."). Added to the
          // stored reply only, never emitted, so what the reviewer sees while
          // it streams does not change.
          if (round > 0 && reply && !reply.endsWith("\n")) {
            reply += "\n\n";
          }

          const claude = client.messages.stream({
            model: "claude-opus-5",
            max_tokens: MAX_REPLY_TOKENS,
            // The global instructions are byte-identical across every prototype
            // and every reviewer, so caching them is worth the breakpoint.
            system: [
              { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
            ],
            // Adaptive thinking lets Claude decide how much to reason. Medium
            // effort suits reviewer questions, which are mostly straightforward
            // lookups against the knowledge base.
            // TUNE HERE: raise to "high" if answers feel shallow.
            thinking: { type: "adaptive" },
            output_config: { effort: "medium" },
            tools: [proposeFeedbackTool],
            messages: conversation,
          });

          for await (const event of claude) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              reply += event.delta.text;
              emit({ t: "text", v: event.delta.text });
            }
          }

          const final = await claude.finalMessage();
          if (final.stop_reason !== "tool_use") break;

          // The assistant's turn goes back verbatim, thinking blocks included.
          // Stripping them would break the tool-use exchange.
          conversation.push({ role: "assistant", content: final.content });

          const results: Anthropic.ToolResultBlockParam[] = [];

          for (const block of final.content) {
            if (block.type !== "tool_use") continue;

            if (block.name !== PROPOSE_FEEDBACK) {
              results.push({
                type: "tool_result",
                tool_use_id: block.id,
                is_error: true,
                content: "No such tool.",
              });
              continue;
            }

            const draft = propose(block.input);

            if (!draft) {
              results.push({
                type: "tool_result",
                tool_use_id: block.id,
                is_error: true,
                content:
                  "Nothing was proposed: say at least what happened, what was expected, or add a note.",
              });
              continue;
            }

            emit({ t: "draft", v: draft });
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content:
                "Proposed. The reviewer is looking at a draft card now and will save or discard it themselves. Do not read it back to them in full and do not ask them to confirm -- the card is the question. One short line naming what you put up is enough, then carry on.",
            });
          }

          conversation.push({ role: "user", content: results });

          if (round + 1 >= MAX_TOOL_ROUNDS) break;
        }
      } catch (error) {
        // A reviewer who navigates away or refreshes mid-answer aborts the
        // request, which surfaces here as a stream error. That is not a
        // failure of the assistant, and labelling it as one would put a
        // misleading note in the transcript -- so keep whatever was written
        // and say nothing.
        const abandoned =
          request.signal.aborted ||
          (error instanceof Error &&
            (error.name === "AbortError" || error.name === "ResponseAborted"));

        if (!abandoned) {
          // The reviewer has been watching an empty panel; say something
          // rather than leaving them guessing.
          const note =
            error instanceof Anthropic.APIError
              ? `\n\n[The assistant could not answer just now: ${error.message}]`
              : "\n\n[The assistant could not answer just now. Please try again.]";
          reply += note;
          emit({ t: "text", v: note });
        }
      } finally {
        // Persist whatever was produced, including a partial answer -- the
        // reviewer saw it, so the transcript should show it.
        if (reply.trim()) {
          await db
            .insert(message)
            .values({ sessionId, role: "assistant", content: reply })
            .catch(() => {});
        }
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed because the reviewer navigated away.
        }
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      // Newline-delimited JSON. Not application/json: this is a stream of
      // objects, not one document, and calling it JSON invites something in
      // the chain to try to buffer and parse the whole thing.
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Stops proxies buffering the stream into one lump at the end.
      "X-Accel-Buffering": "no",
    },
  });
}

/** Streaming a reply can outlast the default function timeout on a long answer. */
export const maxDuration = 60;
