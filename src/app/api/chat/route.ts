/**
 * The reviewer assistant.
 *
 * Everything about Claude happens here, on the server. The API key is read
 * from the environment in this file and nowhere else, so it never reaches the
 * browser -- the browser only ever POSTs a message and reads back text.
 *
 * The response is streamed. A reviewer watching a blank panel for eight
 * seconds assumes it is broken; watching words appear, they wait.
 */

import Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { message, notBuilt, prototype, session, version } from "@/db/schema";
import { buildSystemPrompt } from "@/lib/assistant-context";
import { anthropicApiKey, hasAnthropicApiKey } from "@/lib/env";
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

  let payload: { prototypeId?: unknown; message?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const prototypeId = String(payload.prototypeId ?? "");
  const text = String(payload.message ?? "").trim();

  if (!UUID.test(prototypeId)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "Say something first." }, { status: 400 });
  }
  if (text.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "That message is too long." }, { status: 400 });
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
      name: prototype.name,
      description: prototype.description,
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

  const notBuiltRows = await db
    .select({ text: notBuilt.text })
    .from(notBuilt)
    .where(eq(notBuilt.versionId, context.versionId));

  const systemPrompt = await buildSystemPrompt({
    name: context.name,
    description: context.description,
    versionLabel: context.versionLabel,
    knowledgeBaseText: context.knowledgeBaseText,
    notBuilt: notBuiltRows.map((r) => r.text),
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

  // Persist the reviewer's message before calling out, so it is not lost if
  // the API call fails.
  await db.insert(message).values({ sessionId, role: "user", content: text });

  const client = new Anthropic({ apiKey: anthropicApiKey() });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      try {
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
          messages: [...history, { role: "user", content: text }],
        });

        for await (const event of claude) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            reply += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        await claude.finalMessage();
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
          try {
            controller.enqueue(encoder.encode(note));
          } catch {
            // The reviewer is already gone; nothing to tell them.
          }
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
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Stops proxies buffering the stream into one lump at the end.
      "X-Accel-Buffering": "no",
    },
  });
}

/** Streaming a reply can outlast the default function timeout on a long answer. */
export const maxDuration = 60;
