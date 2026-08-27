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

import { MODE_DESCRIPTIONS, type AssistantMode } from "@/lib/briefing";
import { ROLE_INSTRUCTIONS, ROLE_LABELS, type ReviewerRole } from "@/lib/reviewer-role";

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

/** One thing the reviewer may be asked to try. */
export interface ContextTask {
  goal: string;
  successState: string | null;
}

/** One thing the ticket promised. */
export interface ContextCriterion {
  ref: string | null;
  text: string;
  verifiableInPrototype: boolean;
}

/**
 * What the reviewer's browser can see of the prototype right now.
 *
 * All of it comes from the browser, because only the browser can read the
 * framed document -- the server never sees it. It is therefore untrusted input
 * and is trimmed like anything else typed into a box, which is also why none of
 * it is ever treated as an instruction.
 *
 * Absent on a prototype that marks no screens, and absent entirely on the first
 * turn of a session that has not begun.
 */
export interface Looking {
  /** The screen showing right now, when the prototype says which one it is. */
  screen: string | null;
  /** The last few things the reviewer did, already worded for reading. */
  path: string;
  /** What they have just pointed at, waiting to be attached to something. */
  reference: { label: string | null; screenId: string | null } | null;
}

export interface PrototypeContext {
  name: string;
  description: string | null;
  versionLabel: string;
  knowledgeBaseText: string | null;
  notBuilt: string[];
  /** How hard to push. See prompts/assistant.md for what each one means. */
  mode: AssistantMode;
  /** Who is reviewing, and what they are here as. */
  reviewerName: string;
  reviewerRole: ReviewerRole;
  /** The situation to set up in the opening, when there is one. */
  scenario: string | null;
  tasks: ContextTask[];
  criteria: ContextCriterion[];
  /** Where the reviewer is in the prototype, as of this message. */
  looking: Looking;
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

  parts.push(
    [
      "# Who you are talking to",
      "",
      `${context.reviewerName}, here as: ${ROLE_LABELS[context.reviewerRole]}.`,
      "",
      ROLE_INSTRUCTIONS[context.reviewerRole],
      "",
      "This changes what you ask about. It does not change how hard you push,",
      "which is the mode below.",
    ].join("\n"),
  );

  // The mode, in the assistant's own vocabulary rather than as a bare word.
  // prompts/assistant.md describes all three; this says which one is live and
  // repeats the description so the two can never drift apart in the model's
  // reading of them.
  parts.push(
    [
      "# Mode",
      "",
      `This prototype is in ${context.mode.toUpperCase()} mode.`,
      "",
      MODE_DESCRIPTIONS[context.mode],
      "",
      "The reviewer's own intent overrides this. Someone who is clearly just",
      "looking around gets browse behaviour whatever the mode says.",
    ].join("\n"),
  );

  parts.push(watching(context.looking));

  if (context.scenario?.trim()) {
    parts.push(
      [
        "# Scenario",
        "",
        "Set this up in your opening, in one line, in your own words. Do not",
        "read it out verbatim and do not repeat it later.",
        "",
        context.scenario.trim(),
      ].join("\n"),
    );
  }

  if (context.tasks.length > 0) {
    parts.push(
      [
        "# Tasks",
        "",
        "What the reviewer can be asked to try. Offer these once, as a list,",
        "when it fits -- never in your opening, because a task list as a",
        "greeting reads like homework. Never navigate for them: if they cannot",
        "find something, that is the finding.",
        "",
        ...context.tasks.map((task, index) => {
          const line = `${index + 1}. ${task.goal}`;
          return task.successState
            ? `${line}\n   Done when: ${task.successState}`
            : line;
        }),
      ].join("\n"),
    );
  }

  if (context.criteria.length > 0) {
    const checkable = context.criteria.filter((c) => c.verifiableInPrototype);
    const notCheckable = context.criteria.filter((c) => !c.verifiableInPrototype);

    parts.push(
      [
        "# Acceptance criteria",
        "",
        "What the ticket promised. A reviewer can give a verdict on each one.",
        "",
        ...checkable.map((c) => `- ${c.ref ? `${c.ref}: ` : ""}${c.text}`),
        ...(notCheckable.length > 0
          ? [
              "",
              "These cannot be checked by clicking a prototype -- they are about",
              "timing, real data, notifications or another system. Say so plainly",
              "if a reviewer tries; do not let them guess and do not record a",
              "verdict on one.",
              "",
              ...notCheckable.map((c) => `- ${c.ref ? `${c.ref}: ` : ""}${c.text}`),
            ]
          : []),
      ].join("\n"),
    );
  }

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

  parts.push(capabilities());

  return parts.join("\n\n---\n\n");
}

/* --------------------------------------------------------------------------
 * Where the reviewer is.
 *
 * The awkward part of this section is not building it, it is saying what to do
 * with it. prompts/assistant.md is explicit: "I see you have been on the plan
 * screen for two minutes" is creepy, and "anything missing here?" is the same
 * observation used well. So the instruction here is to use it and not to recite
 * it, and it is repeated where the facts are rather than left in the global
 * file, because this is the section that tempts.
 * ------------------------------------------------------------------------ */
function watching(looking: Looking): string {
  const lines = ["# Where they are right now", ""];

  if (looking.screen) {
    lines.push(
      `They are on the screen the prototype calls **${looking.screen}**.`,
      "",
      "Use that name when you propose feedback. Do not ask which screen they",
      "mean, and do not read the name back to them -- it is theirs to recognise,",
      "not yours to announce.",
    );
  } else {
    lines.push(
      "This prototype does not say which screen is showing, so you do not know.",
      "Ask which screen they mean when it matters, once, plainly.",
    );
  }

  if (looking.path.trim()) {
    lines.push(
      "",
      "What they have just done, oldest first:",
      "",
      looking.path.trim(),
      "",
      "This is context, never conversation. Never narrate it back. A click",
      "marked \"nothing happened\" means the prototype did not change when they",
      "pressed it -- worth mentioning once if they press it again, and never a",
      "finding on its own, because plenty of things correctly do nothing.",
    );
  }

  if (looking.reference) {
    const what = looking.reference.label ?? "part of the screen";
    lines.push(
      "",
      `They have just pointed at **${what}**` +
        (looking.reference.screenId ? ` on ${looking.reference.screenId}.` : "."),
      "",
      "A picture of it is waiting in their panel and will be attached to the",
      "next thing they save. So do not ask them which element they mean, and do",
      "not ask them to describe it: they have shown you. Ask what is wrong with",
      "it, or what they expected it to do.",
    );
  }

  return lines.join("\n");
}

/* --------------------------------------------------------------------------
 * What the assistant can actually see and do, right now.
 *
 * prompts/assistant.md deliberately does not list these. That file is written
 * once and edited by hand; this list changes every time a chunk lands, and a
 * hand-written capability list is a promise that goes stale silently. An
 * assistant that believes it can highlight an element will offer to, and the
 * reviewer will wait for something that never happens.
 *
 * So the file points here, and this is generated from what is wired up. When a
 * later chunk adds screen awareness or the highlight tool, the lines move from
 * one list to the other and the prompt is correct the same day.
 * ------------------------------------------------------------------------ */
function capabilities(): string {
  // One entry per bullet. Deliberately not wrapped in the source: a string
  // broken across lines for readability becomes several bullets in the prompt,
  // and a list where half the items are sentence fragments reads as noise.
  const canSee = [
    "Everything in the sections above: what this prototype is, its mode, who is reviewing and as what, the tasks, the criteria, what is deliberately not built, and everything already saved this session.",
    "The conversation itself.",
    "Which screen they are on, when the prototype marks its screens. The section above says so, or says that it does not.",
    "The last few things they did: which screens they moved between, what they clicked, and whether the prototype changed when they clicked it.",
    "The name of anything they have pointed at, and that a picture of it is waiting.",
  ];

  const cannotSee = [
    "The screen itself. You know its name and what was clicked; you have never seen the pixels and cannot describe what anything looks like.",
    "Anything they have typed into the prototype, or how long they have been anywhere.",
  ];

  const canDo = [
    "Propose a feedback item. The reviewer sees it as a draft and saves or discards it.",
    "Ask them to point at something. There is a target button beside the message box: pressing it and then clicking anything in the prototype takes a picture of it, which is attached to the next thing they save. \"Point at it\" is a real instruction here, not a figure of speech.",
  ];

  const cannotDo = [
    "Take a picture yourself. Only the reviewer can, with the button described above.",
    "Mark a task done, or record a verdict on an acceptance criterion. You can still talk about both, and anything they say about one is worth proposing as feedback.",
    "Highlight or point at anything in the prototype yourself.",
    "Write the closing summary. The reviewer gets a report built from what they saved.",
  ];

  return [
    "# What you can see and do right now",
    "",
    "This list is generated from the running code. It is the truth, and it beats",
    "anything you assume.",
    "",
    "You can see:",
    ...canSee.map((line) => `- ${line}`),
    "",
    "You cannot see:",
    ...cannotSee.map((line) => `- ${line}`),
    "",
    "Use what you are given and do not narrate it. Knowing which screen somebody",
    "is on is for asking a better question, not for telling them where they are.",
    "Never guess a screen name when you propose something: use the one you were",
    "given, or leave it out and let it be filled in.",
    "",
    "You can:",
    ...canDo.map((line) => `- ${line}`),
    "",
    "You cannot yet:",
    ...cannotDo.map((line) => `- ${line}`),
    "",
    "Do not promise any of these are coming. Say what you can do instead.",
  ].join("\n");
}

