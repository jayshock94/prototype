/**
 * Reading the framed prototype: which screen is showing, and what was clicked.
 *
 * This is the whole reason CLAUDE.md insists the prototype is served from
 * /p/[versionId] rather than from a Blob URL. Same origin means the review
 * page can reach `iframe.contentDocument` and read it. A cross-origin iframe
 * would render identically and give us nothing.
 *
 * Everything here runs in the browser and touches no framework. It is kept out
 * of the React components because the awkward parts -- shadow DOM, a prototype
 * that renders a second after `load`, three different ways of marking a screen
 * -- are about the DOM, not about rendering, and they are much easier to read
 * on their own.
 *
 * Nothing here writes to the prototype. Not one attribute, not one style: the
 * document in the frame is somebody's finished artefact and a review must not
 * be able to change what it is reviewing. The hover highlight the reviewer sees
 * is drawn in the parent page, over the top.
 */

/* --------------------------------------------------------------------------
 * Screens
 * ------------------------------------------------------------------------ */

/**
 * The attributes a screen may be marked with.
 *
 * `data-screen` is the convention in CLAUDE.md. `data-screen-label` is what the
 * first real prototype actually used, which is the more useful fact of the two:
 * whatever the convention says, prototypes arrive as they arrive, and a screen
 * detector that only understands the documented spelling detects nothing.
 *
 * `id` on a `<section>` is the third guess, and it is deliberately last. Plenty
 * of prototypes mark nothing at all, and guessing from ids is better than
 * saying "unknown" -- but it is a guess, so anything explicit wins.
 */
const SCREEN_ATTRIBUTES = ["data-screen", "data-screen-label"] as const;

/** How long to keep looking for screens after the frame reports `load`. */
const SETTLE_MS = 8000;

/**
 * Is this element actually on screen right now?
 *
 * Prototypes hide screens in every way a person might: `display: none`, a
 * `hidden` attribute, a class that sets visibility, zero height, or moving it
 * off to one side. Checking the box the browser has actually laid out catches
 * all of those at once and needs no knowledge of how the prototype does it.
 */
function isShowing(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;

  const view = element.ownerDocument.defaultView;
  if (!view) return false;

  const style = view.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (Number(style.opacity) === 0) return false;

  // Wholly outside the viewport in either direction. A screen scrolled halfway
  // out of view is still the screen you are on, so only a rectangle that misses
  // the viewport entirely counts as hidden.
  if (rect.bottom <= 0 || rect.top >= view.innerHeight) return false;
  if (rect.right <= 0 || rect.left >= view.innerWidth) return false;

  return true;
}

/**
 * The name of the screen currently showing, or null if there is nothing to go
 * on.
 *
 * When several marked screens are visible at once -- a nested container, a
 * sheet over a page -- the one whose laid-out box is largest wins. That is the
 * one filling the reviewer's view, which is what they would call "the screen
 * I am on".
 */
export function currentScreen(doc: Document): string | null {
  let best: { name: string; area: number } | null = null;

  for (const attribute of SCREEN_ATTRIBUTES) {
    for (const element of Array.from(doc.querySelectorAll(`[${attribute}]`))) {
      const name = element.getAttribute(attribute)?.trim();
      if (!name) continue;
      if (!isShowing(element)) continue;

      const rect = element.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (!best || area > best.area) best = { name, area };
    }
  }

  if (best) return best.name;

  // Nothing is marked. Fall back to a visible <section id> or <main id>, which
  // is how a hand-written prototype that never read CLAUDE.md tends to look.
  for (const element of Array.from(doc.querySelectorAll("section[id], main[id]"))) {
    if (isShowing(element)) return element.id;
  }

  return null;
}

/* --------------------------------------------------------------------------
 * Naming an element
 * ------------------------------------------------------------------------ */

/** Longest name we will produce. A whole paragraph is not a name. */
const MAX_LABEL_CHARS = 80;

function tidy(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * What to call the thing the reviewer clicked.
 *
 * A ladder, in the order that produces the most recognisable name:
 *
 *   1. `aria-label` -- written for exactly this purpose.
 *   2. `title`, `alt`, `placeholder`, `value` on a button -- the same, less
 *      deliberately.
 *   3. The element's own text, if it is short enough to be a label rather than
 *      a paragraph.
 *   4. The kind of thing it is, placed under the nearest heading above it.
 *
 * Rung 4 is why this is worth doing at all. "Button" tells a designer nothing;
 * "button under Payment details" is a place they can find.
 */
export function describeElement(element: Element): string {
  const attribute =
    tidy(element.getAttribute("aria-label")) ||
    tidy(element.getAttribute("title")) ||
    tidy(element.getAttribute("alt")) ||
    tidy(element.getAttribute("placeholder"));

  if (attribute) return attribute.slice(0, MAX_LABEL_CHARS);

  /*
   * A submit button's label lives in its value, not its text.
   *
   * Note the tag name test rather than `instanceof HTMLInputElement`. Every
   * document has its own copy of every DOM class, so `instanceof` against this
   * page's classes is false for every node in the framed document -- silently,
   * with no error. Nothing in this file may use it.
   */
  if (element.tagName === "INPUT") {
    const input = element as HTMLInputElement;
    if (input.type !== "text") {
      const value = tidy(input.value);
      if (value) return value.slice(0, MAX_LABEL_CHARS);
    }
  }

  const text = tidy(element.textContent);
  if (text && text.length <= MAX_LABEL_CHARS) return text;

  const kind = kindOf(element);
  const heading = nearestHeading(element);
  return heading ? `${kind} under “${heading}”` : kind;
}

/** A plain-language word for what this element is. */
function kindOf(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const role = tidy(element.getAttribute("role")).toLowerCase();

  if (role) return role;
  if (tag === "a") return "link";
  if (tag === "button") return "button";
  if (tag === "input") {
    const type = (element as HTMLInputElement).type;
    return type === "checkbox" || type === "radio" ? type : "field";
  }
  if (tag === "select") return "dropdown";
  if (tag === "textarea") return "text box";
  if (tag === "img") return "image";
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "li") return "list item";
  if (tag === "td" || tag === "th") return "table cell";
  return "area";
}

/**
 * The nearest heading above this element, walking up and back.
 *
 * Ancestors first, then the earlier siblings of each ancestor, which is how a
 * person reading the page would find the heading a control sits under.
 */
function nearestHeading(element: Element): string | null {
  let node: Element | null = element;

  while (node && node.tagName !== "BODY") {
    let sibling = node.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) {
        const text = tidy(sibling.textContent);
        if (text) return text.slice(0, MAX_LABEL_CHARS);
      }
      // A heading is often wrapped rather than a direct sibling.
      const inside = sibling.querySelector("h1, h2, h3, h4, h5, h6");
      if (inside) {
        const text = tidy(inside.textContent);
        if (text) return text.slice(0, MAX_LABEL_CHARS);
      }
      sibling = sibling.previousElementSibling;
    }
    node = node.parentElement;
  }

  return null;
}

/* --------------------------------------------------------------------------
 * Pointing at it again later
 * ------------------------------------------------------------------------ */

/**
 * A CSS selector for one element, good enough to find it again.
 *
 * Not guaranteed unique and not meant to be pretty: it is a record of where
 * something was, stored beside the screenshot in case a later chunk wants to
 * re-find it. The screenshot is what a person looks at.
 *
 * Stops at the first id it meets, because an id is the one thing in a document
 * that is supposed to be unique, and a path anchored to one is shorter and
 * survives more of the document changing around it.
 */
export function cssPath(element: Element): string {
  const parts: string[] = [];
  let node: Element | null = element;

  while (node && node.nodeType === 1 && parts.length < 8) {
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }

    const tag = node.tagName.toLowerCase();
    if (tag === "html" || tag === "body") {
      parts.unshift(tag);
      break;
    }

    const parent: Element | null = node.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }

    const twins = Array.from(parent.children).filter(
      (child) => child.tagName === node!.tagName,
    );
    parts.unshift(
      twins.length > 1 ? `${tag}:nth-of-type(${twins.indexOf(node) + 1})` : tag,
    );
    node = parent;
  }

  return parts.join(" > ");
}

/* --------------------------------------------------------------------------
 * Watching
 * ------------------------------------------------------------------------ */

/** One thing the reviewer did, in the order it happened. */
export interface PathStep {
  /** "screen" when the view changed, "click" when they pressed something. */
  kind: "screen" | "click";
  /** The screen name at the time, when there is one. */
  screen: string | null;
  /** What they clicked. Absent for a screen change. */
  label?: string;
  /** Milliseconds since the watcher started. Used for "stalled", never shown. */
  at: number;
  /**
   * True when nothing in the document changed in the moment after the click.
   *
   * A signal to ask about -- "that one is not wired up, here is what would
   * happen for real" -- and never a finding on its own. Plenty of buttons
   * correctly do nothing.
   */
  dead?: boolean;
}

export interface EyesEvents {
  onScreen: (screen: string | null) => void;
  onStep: (step: PathStep) => void;
}

/**
 * How long to wait after a click before deciding nothing happened.
 *
 * Long enough for a transition or a re-render, short enough that the answer is
 * still about the click the reviewer just made.
 */
const DEAD_CLICK_MS = 400;

/**
 * Start watching a framed prototype. Returns a function that stops.
 *
 * Three things make this less obvious than it looks:
 *
 *  - **The frame's document is replaced on navigation.** Listeners are bound
 *    on every `load`, and anything bound to the previous document is dropped
 *    with it.
 *  - **The content arrives after `load`.** The first real prototype put through
 *    this is a bundled app that paints about a second later, so reading the
 *    screen once on load reads an empty page. A MutationObserver handles the
 *    ordinary case and a slow poll covers the first few seconds, after which
 *    the observer alone is enough.
 *  - **Clicks have to be caught in the capture phase**, before the prototype's
 *    own handler can stop them propagating, and the target has to come from
 *    `composedPath()` rather than `event.target` -- a click inside a shadow
 *    root is retargeted to the host, which would name the whole component
 *    instead of the button that was pressed.
 */
export function watchPrototype(
  iframe: HTMLIFrameElement,
  events: EyesEvents,
): () => void {
  const started = Date.now();
  let stopped = false;
  let screen: string | null = null;
  let detach: (() => void) | null = null;

  function reportScreen(doc: Document) {
    const next = currentScreen(doc);
    if (next === screen) return;
    screen = next;
    events.onScreen(next);
    events.onStep({ kind: "screen", screen: next, at: Date.now() - started });
  }

  function bind() {
    detach?.();
    detach = null;

    const doc = iframe.contentDocument;
    if (!doc) return;

    const onClick = (event: Event) => {
      const path = event.composedPath();
      const target = (path[0] ?? event.target) as Element | null;
      if (!target || target.nodeType !== 1) return;

      /*
       * Reported now, with the screen they were on when they pressed it.
       *
       * Waiting the four hundred milliseconds first and reporting afterwards
       * is the obvious way to write this and it is wrong twice over: the click
       * lands in the path *after* the screen change it caused, and it gets
       * labelled with the screen it arrived at rather than the one it was
       * made on. "Clicked Send a counteroffer on Counteroffer" reads as though
       * they pressed it twice.
       *
       * So the step goes out immediately and the dead-click answer is written
       * onto the same object when it is known. The digest is built when a
       * message is sent, which is always later than that.
       */
      const step: PathStep = {
        kind: "click",
        screen,
        label: describeElement(target),
        at: Date.now() - started,
      };
      events.onStep(step);

      let changed = false;
      const observer = new MutationObserver(() => {
        changed = true;
      });
      observer.observe(doc, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });

      window.setTimeout(() => {
        observer.disconnect();
        if (stopped) return;
        if (!changed) step.dead = true;
        // Belt and braces: the screen observer usually has this already, but a
        // prototype that swaps screens outside the watched tree would not.
        reportScreen(doc);
      }, DEAD_CLICK_MS);
    };

    doc.addEventListener("click", onClick, true);

    // Screens are shown and hidden by JavaScript, so there is no event to
    // listen for. Watching the document for any change and re-reading which
    // screen is showing is the only honest way to know.
    const observer = new MutationObserver(() => reportScreen(doc));
    observer.observe(doc.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", ...SCREEN_ATTRIBUTES],
    });

    // The observer misses the very first paint of a bundled app, which happens
    // before this runs on a slow load. A poll for the first few seconds covers
    // it, and then stops rather than running for the whole review.
    const poll = window.setInterval(() => {
      if (Date.now() - started > SETTLE_MS) {
        window.clearInterval(poll);
        return;
      }
      reportScreen(doc);
    }, 400);

    reportScreen(doc);

    detach = () => {
      doc.removeEventListener("click", onClick, true);
      observer.disconnect();
      window.clearInterval(poll);
    };
  }

  iframe.addEventListener("load", bind);
  // Already loaded by the time the effect runs, which is the usual case when
  // React mounts after the frame has fetched its document.
  if (iframe.contentDocument?.readyState !== "loading") bind();

  return () => {
    stopped = true;
    iframe.removeEventListener("load", bind);
    detach?.();
  };
}

/* --------------------------------------------------------------------------
 * Telling the assistant
 * ------------------------------------------------------------------------ */

/** How many steps of the path to send with a message. */
const DIGEST_STEPS = 8;

/**
 * The path, as a few lines the assistant can read.
 *
 * A digest rather than the raw events, because the raw events are long, dull
 * and mostly noise -- and because the prompt has to stay small enough to send
 * with every single message. What survives is the order things happened in and
 * whether a click did anything, which is what a person could act on.
 *
 * Timing is collected but deliberately left out, exactly as CLAUDE.md says:
 * "stalled" needs it, a report does not.
 */
export function pathDigest(steps: PathStep[]): string {
  const recent = steps.slice(-DIGEST_STEPS);
  if (recent.length === 0) return "";

  return recent
    .map((step) => {
      if (step.kind === "screen") {
        return `Moved to ${step.screen ?? "an unnamed screen"}`;
      }
      const where = step.screen ? ` on ${step.screen}` : "";
      const dead = step.dead ? " (nothing happened)" : "";
      return `Clicked ${step.label ?? "something"}${where}${dead}`;
    })
    .join("\n");
}

/** How many times the same screen appears in the path. */
export function visitCount(steps: PathStep[], screen: string): number {
  return steps.filter((step) => step.kind === "screen" && step.screen === screen)
    .length;
}
