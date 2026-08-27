/**
 * Building the assistant's system prompt.
 *
 * Two parts, as CLAUDE.md describes:
 *
 *   1. prompts/assistant.md -- the global instructions, identical for every
 *      prototype. Edited by hand; this is the file that decides whether the
 *      assistant is any use.
 *   2. Per-prototype context appended underneath: what this prototype is, its
 *      knowledge base, and anything recorded as deliberately not built.
 *
 * Order matters for prompt caching: the global file is byte-identical across
 * every prototype and every reviewer, so it sits first and stays cacheable.
 * The per-prototype part changes per prototype but not per message, so it is
 * stable within a conversation too.
 */

import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Read once per server instance rather than per message.
 *
 * The file only changes on deploy, and a deploy starts a new instance. If you
 * edit prompts/assistant.md you must redeploy for it to take effect -- that is
 * the trade for not reading from disk on every keystroke.
 *
 * next.config.ts has an outputFileTracingIncludes entry for prompts/, without
 * which this file would not be bundled into the deployed function and this
 * read would fail in production while working perfectly in development.
 */
let cachedGlobalPrompt: string | null = null;

async function globalPrompt(): Promise<string> {
  if (cachedGlobalPrompt === null) {
    cachedGlobalPrompt = await readFile(
      path.join(process.cwd(), "prompts", "assistant.md"),
      "utf8",
    );
  }
  return cachedGlobalPrompt;
}

/** One feedback row already recorded this visit, as the prompt describes it. */
export interface RecordedFeedback {
  severity: string;
  screenId: string | null;
  happened: string | null;
  expected: string | null;
  note: string | null;
}

export interface PrototypeContext {
  name: string;
  description: string | null;
  versionLabel: string;
  knowledgeBaseText: string | null;
  notBuilt: string[];
  /**
   * Everything logged so far in this reviewer's session.
   *
   * Deliberately not part of the message history. The transcript says what was
   * *said*; this says what was *kept*, and the two drift apart the moment the
   * reviewer deletes an item. Feeding the live list stops the assistant
   * logging the same complaint twice when a reviewer circles back to it, and
   * lets it answer "what have I flagged so far?" accurately.
   */
  recorded: RecordedFeedback[];
}

/** Assemble the full system prompt for one prototype. */
export async function buildSystemPrompt(context: PrototypeContext): Promise<string> {
  const parts = [await globalPrompt()];

  parts.push(
    [
      "# This prototype",
      "",
      `Name: ${context.name}`,
      `Version: ${context.versionLabel}`,
      context.description ? `Description: ${context.description}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  if (context.knowledgeBaseText?.trim()) {
    parts.push(
      [
        "# Knowledge base",
        "",
        "Everything you know about how this prototype is supposed to behave.",
        "",
        context.knowledgeBaseText.trim(),
      ].join("\n"),
    );
  } else {
    parts.push(
      [
        "# Knowledge base",
        "",
        "None was provided for this prototype. You have nothing to go on beyond",
        "what the reviewer tells you, so be especially careful not to invent",
        "behaviour -- say that you do not know.",
      ].join("\n"),
    );
  }

  if (context.notBuilt.length > 0) {
    parts.push(
      [
        "# Deliberately not built",
        "",
        "These are out of scope for this prototype. If a reviewer asks about",
        "one, say it is not part of this prototype rather than describing how",
        "it works.",
        "",
        ...context.notBuilt.map((item) => `- ${item}`),
      ].join("\n"),
    );
  }

  parts.push(
    context.recorded.length > 0
      ? [
          "# Already recorded this session",
          "",
          "These are in the reviewer's list right now. Do not record any of them",
          "again, even if the reviewer mentions it a second time -- say it is",
          "already logged. If they add detail to one, say you have noted it and",
          "record a new item only if it is genuinely a different point.",
          "",
          ...context.recorded.map((item) => {
            const where = item.screenId ? ` (${item.screenId})` : "";
            const body = [item.happened, item.expected, item.note]
              .filter(Boolean)
              .join(" / ");
            return `- [${item.severity}]${where} ${body}`;
          }),
        ].join("\n")
      : [
          "# Already recorded this session",
          "",
          "Nothing yet.",
        ].join("\n"),
  );

  return parts.join("\n\n---\n\n");
}
