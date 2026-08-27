/**
 * Taking a picture of part of the framed prototype, in the browser.
 *
 * WHY THIS EXISTS, AND WHY IT IS HAND-WRITTEN
 *
 * A browser cannot screenshot a page. `getDisplayMedia` can, but it puts an
 * operating-system share-picker in front of the reviewer every single time,
 * which is not a thing anybody will do twice. The only way to turn a piece of
 * live DOM into an image without asking permission is the trick below: build an
 * SVG whose `<foreignObject>` contains a copy of the markup, hand that SVG to
 * an `<img>`, and paint the `<img>` onto a canvas.
 *
 * There are libraries for this. This one is written out for a reason that is
 * not the usual dependency squeamishness: the element being captured lives in
 * a *different document* -- the iframe's -- and the common libraries read
 * computed styles from the wrong window when you hand them a foreign node.
 * Everything here explicitly uses the frame's own view, which is the whole
 * difference between a faithful picture and a stack of unstyled text.
 *
 * WHAT IT CANNOT DO. All of these are silent: the picture comes out, with the
 * missing part missing.
 *
 *  - **Images from another site do not appear.** An SVG loaded into an `<img>`
 *    is rendered in what the spec calls secure static mode, which refuses every
 *    external reference. A prototype that inlines its images as `data:` URIs --
 *    which is what "one self-contained HTML file" means in CLAUDE.md -- is
 *    fine. One that hotlinks a CDN gets blank boxes.
 *  - **Web fonts fall back to the system font**, for the same reason. Sizes and
 *    layout are correct because they come from the computed styles; the letter
 *    shapes may not be.
 *  - **`::before` and `::after` are not copied.** Icon fonts that draw through
 *    a pseudo-element vanish.
 *  - **Canvas, video and iframes inside the prototype come out blank.**
 *  - **Nothing is captured that the browser has not laid out.** A hidden screen
 *    is skipped entirely, which is the behaviour we want.
 *
 * If a prototype ever needs better than this, the answer is a real headless
 * browser on the server, not a bigger version of this file.
 */

/** Above this many elements, stop copying. A guard, not a design limit. */
const MAX_NODES = 8000;

/** The most pixels we will paint. Roughly a 1600 x 1200 picture. */
const MAX_OUTPUT_PIXELS = 2_000_000;

/** Never produce an image wider than this, whatever the screen is. */
const MAX_OUTPUT_WIDTH = 1600;

/** Space left around the element, so it is shown in its surroundings. */
const PADDING = 28;

/** The smallest crop worth looking at. A lone 16px icon needs its context. */
const MIN_CROP_WIDTH = 400;
const MIN_CROP_HEIGHT = 260;

/** The red the report and the review panel both use to mark the target. */
const MARKER_COLOUR = "#b3261e";

export interface Capture {
  blob: Blob;
  /** Pixel size of the image produced. */
  width: number;
  height: number;
  /** Where the element sat in the document, in CSS pixels. */
  rect: { x: number; y: number; width: number; height: number };
}

/**
 * Every CSS property copied onto the clone.
 *
 * Curated rather than "all of them". `getComputedStyle` exposes several hundred
 * properties, and writing all of them onto every node turns a modest screen
 * into several megabytes of markup that then has to be parsed as XML. This list
 * is everything that changes what a static picture looks like.
 */
const COPIED_PROPERTIES = [
  // Box
  "display", "position", "top", "right", "bottom", "left", "float", "clear",
  "width", "height", "min-width", "min-height", "max-width", "max-height",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "box-sizing", "overflow-x", "overflow-y", "z-index", "visibility",
  // Flex and grid
  "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
  "justify-content", "justify-items", "justify-self",
  "align-items", "align-self", "align-content", "order",
  "gap", "row-gap", "column-gap",
  "grid-template-columns", "grid-template-rows", "grid-template-areas",
  "grid-column", "grid-row", "grid-area",
  "grid-auto-flow", "grid-auto-rows", "grid-auto-columns",
  // Type
  "font-family", "font-size", "font-weight", "font-style", "font-variant",
  "line-height", "letter-spacing", "word-spacing", "text-align",
  "text-decoration-line", "text-decoration-color", "text-decoration-style",
  "text-transform", "text-indent", "text-shadow", "white-space", "word-break",
  "overflow-wrap", "vertical-align", "direction", "color",
  // Paint
  "background-color", "background-image", "background-size",
  "background-position", "background-repeat", "background-clip",
  "background-origin", "opacity", "box-shadow", "filter", "mix-blend-mode",
  // Border
  "border-top-width", "border-right-width", "border-bottom-width",
  "border-left-width",
  "border-top-style", "border-right-style", "border-bottom-style",
  "border-left-style",
  "border-top-color", "border-right-color", "border-bottom-color",
  "border-left-color",
  "border-top-left-radius", "border-top-right-radius",
  "border-bottom-right-radius", "border-bottom-left-radius",
  // The rest
  "border-collapse", "border-spacing", "table-layout",
  "list-style-type", "list-style-position",
  "transform", "transform-origin", "object-fit", "object-position",
] as const;

/**
 * Attributes worth carrying to the clone.
 *
 * Deliberately short. Every style is inlined, so classes and ids do nothing but
 * make the markup bigger, and dropping them also removes any chance of a class
 * name that is not valid XML breaking the whole serialisation. What is left is
 * the handful of attributes that change what is drawn rather than how.
 */
const COPIED_ATTRIBUTES = ["src", "alt", "colspan", "rowspan", "dir", "lang"];

/** Never copied: they contribute nothing to a picture, or run. */
const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "NOSCRIPT", "TEMPLATE"]);

/**
 * `instanceof` DOES NOT WORK on nodes from the framed document.
 *
 * Every document has its own copy of every DOM class. `node instanceof Element`
 * asks whether the node was made by *this* page's Element constructor, and a
 * node belonging to the iframe was not -- so the check is false for every
 * element in the prototype, always. It is a nasty one because it is false
 * rather than an error: the first version of this file used
 * `copy instanceof Element` as a sanity check and every single capture failed
 * with "there was nothing to capture".
 *
 * So: compare tag names and node types, which are plain values and cross
 * documents without complaint.
 */
function isTag(node: Node, ...tags: string[]): boolean {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    tags.includes((node as Element).tagName)
  );
}

/**
 * Copy one element's computed style onto the clone as an inline `style`.
 *
 * `view` is the *frame's* window, not ours. That is the important line in this
 * file: `window.getComputedStyle` in the parent page resolves against the
 * parent's document, and for a node that belongs to the iframe it returns
 * either nothing useful or a browser-default style. Everything would then come
 * out as unstyled black text on white, which looks enough like a real answer to
 * be mistaken for one.
 */
function inlineStyle(source: Element, clone: HTMLElement, view: Window): void {
  const computed = view.getComputedStyle(source);
  const declarations: string[] = [];

  for (const property of COPIED_PROPERTIES) {
    const value = computed.getPropertyValue(property);
    if (!value) continue;
    declarations.push(`${property}:${value}`);
  }

  clone.setAttribute("style", declarations.join(";"));
}

/**
 * A form control, redrawn as a plain box with its current text in it.
 *
 * Native controls inside a `<foreignObject>` that is being rasterised come out
 * as blank rectangles or as the browser's own unstyled widget, neither of which
 * is what the reviewer is looking at. Since every style has been copied
 * already, a `<div>` carrying the same border, padding and background is a
 * closer likeness than the real control -- and it shows the value the reviewer
 * actually typed, which the markup alone does not.
 */
function controlText(element: Element): string | null {
  if (isTag(element, "INPUT")) {
    const input = element as HTMLInputElement;
    if (input.type === "checkbox" || input.type === "radio") {
      return input.checked ? "☑" : "☐";
    }
    if (input.type === "password") return "•".repeat(input.value.length);
    if (input.type === "hidden") return null;
    return input.value || input.placeholder || "";
  }
  if (isTag(element, "TEXTAREA")) {
    const area = element as HTMLTextAreaElement;
    return area.value || area.placeholder || "";
  }
  if (isTag(element, "SELECT")) {
    return (element as HTMLSelectElement).selectedOptions[0]?.text ?? "";
  }
  return null;
}

/**
 * Build the copy of one node, styles and all.
 *
 * Recursive rather than `cloneNode(true)` plus a second pass, because a hidden
 * subtree can then be dropped as it is met instead of being copied, styled and
 * then thrown away. On a bundled app where every screen but one is
 * `display: none`, that is most of the document.
 */
function copyNode(
  source: Node,
  doc: Document,
  view: Window,
  budget: { left: number },
): Node | null {
  if (source.nodeType === Node.TEXT_NODE) {
    const text = source.nodeValue ?? "";
    return text ? doc.createTextNode(text) : null;
  }

  if (source.nodeType !== Node.ELEMENT_NODE) return null;

  const element = source as Element;
  if (SKIPPED_TAGS.has(element.tagName)) return null;
  if (budget.left <= 0) return null;

  const computed = view.getComputedStyle(element);
  if (computed.display === "none") return null;

  budget.left -= 1;

  // Form controls become divs; everything else keeps its own tag so that
  // block-versus-inline, list markers and table layout behave.
  const text = controlText(element);
  const tag = text === null ? element.tagName.toLowerCase() : "div";
  const clone = doc.createElement(tag);

  inlineStyle(element, clone, view);

  for (const name of COPIED_ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (value !== null) clone.setAttribute(name, value);
  }

  if (text !== null) {
    // The control's own box is already right; this only stops a long value
    // from spilling out of it.
    clone.style.overflow = "hidden";
    clone.style.whiteSpace = "pre";
    clone.textContent = text;
    return clone;
  }

  for (const child of Array.from(element.childNodes)) {
    const copy = copyNode(child, doc, view, budget);
    if (copy) clone.appendChild(copy);
  }

  /*
   * A scrolled container renders from the top in the copy, because scroll
   * position is state rather than markup. Shifting the children back by the
   * scroll offset puts the reviewer's view of it back.
   */
  if (element.scrollTop > 0 || element.scrollLeft > 0) {
    const shift = doc.createElement("div");
    shift.setAttribute(
      "style",
      `transform:translate(${-element.scrollLeft}px,${-element.scrollTop}px)`,
    );
    while (clone.firstChild) shift.appendChild(clone.firstChild);
    clone.appendChild(shift);
  }

  return clone;
}

/**
 * Turn an element in a framed prototype into a PNG of it in its surroundings.
 *
 * The picture is a crop, not just the element. A button on its own tells a
 * designer nothing -- what makes a screenshot worth having is seeing where the
 * button is and what is around it -- so the element is drawn with a red
 * rectangle around it and enough of the screen either side to place it.
 *
 * The rectangle is stroked onto the canvas afterwards rather than being an
 * `outline` in the copied markup. That way it cannot be affected by anything
 * the prototype's own styles do, and it cannot be clipped by a parent with
 * `overflow: hidden`.
 *
 * Throws if the frame cannot be read or the browser refuses to rasterise. Every
 * caller treats that as "no picture this time" rather than as a failure of the
 * review.
 */
export async function captureElement(target: Element): Promise<Capture> {
  const doc = target.ownerDocument;
  const view = doc.defaultView;
  if (!view) throw new Error("The prototype frame could not be read.");

  const root = doc.body ?? doc.documentElement;
  const pageWidth = Math.max(
    doc.documentElement.scrollWidth,
    view.innerWidth,
    1,
  );
  const pageHeight = Math.max(
    doc.documentElement.scrollHeight,
    view.innerHeight,
    1,
  );

  // Document coordinates: what getBoundingClientRect gives is relative to the
  // frame's viewport, and the copy is laid out from the top of the document.
  const box = target.getBoundingClientRect();
  const rect = {
    x: box.left + view.scrollX,
    y: box.top + view.scrollY,
    width: box.width,
    height: box.height,
  };

  const crop = cropAround(rect, pageWidth, pageHeight);

  const budget = { left: MAX_NODES };
  const copy = copyNode(root, doc, view, budget);
  if (!copy || copy.nodeType !== Node.ELEMENT_NODE) {
    throw new Error("There was nothing in the prototype to capture.");
  }

  // The page's own backdrop. `<body>` is usually transparent, in which case the
  // colour a reader sees comes from `<html>`; without this the picture would
  // have a transparent background and read as black in most PDF viewers.
  const pageBackground =
    opaque(view.getComputedStyle(doc.documentElement).backgroundColor) ??
    opaque(view.getComputedStyle(root).backgroundColor) ??
    "#ffffff";

  const scale = outputScale(crop, view.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(crop.width * scale));
  const height = Math.max(1, Math.round(crop.height * scale));

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`,
    ` viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}">`,
    `<rect x="${crop.x}" y="${crop.y}" width="${crop.width}" height="${crop.height}"`,
    ` fill="${escapeAttribute(pageBackground)}"/>`,
    `<foreignObject x="0" y="0" width="${pageWidth}" height="${pageHeight}">`,
    `<div xmlns="http://www.w3.org/1999/xhtml">`,
    new XMLSerializer().serializeToString(copy),
    `</div></foreignObject></svg>`,
  ].join("");

  const image = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );

  const canvas = doc.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser would not draw the picture.");

  context.fillStyle = pageBackground;
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  // Where the element ended up inside the crop, in output pixels.
  context.strokeStyle = MARKER_COLOUR;
  context.lineWidth = Math.max(2, Math.round(2 * scale));
  context.strokeRect(
    (rect.x - crop.x) * scale - context.lineWidth / 2,
    (rect.y - crop.y) * scale - context.lineWidth / 2,
    rect.width * scale + context.lineWidth,
    rect.height * scale + context.lineWidth,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("The picture could not be saved.");

  return { blob, width, height, rect };
}

/**
 * The area to show around the element.
 *
 * Padded, grown to a readable minimum, and then pushed back inside the page
 * rather than clamped -- clamping a crop that overhangs the right edge would
 * make it narrower, which is the opposite of what a small target needs.
 */
function cropAround(
  rect: { x: number; y: number; width: number; height: number },
  pageWidth: number,
  pageHeight: number,
): { x: number; y: number; width: number; height: number } {
  let width = Math.min(pageWidth, Math.max(MIN_CROP_WIDTH, rect.width + PADDING * 2));
  let height = Math.min(
    pageHeight,
    Math.max(MIN_CROP_HEIGHT, rect.height + PADDING * 2),
  );

  let x = rect.x + rect.width / 2 - width / 2;
  let y = rect.y + rect.height / 2 - height / 2;

  x = Math.max(0, Math.min(x, pageWidth - width));
  y = Math.max(0, Math.min(y, pageHeight - height));

  width = Math.min(width, pageWidth - x);
  height = Math.min(height, pageHeight - y);

  return { x, y, width, height };
}

/**
 * How many image pixels per CSS pixel.
 *
 * Screen density first, so a picture taken on a laptop with a retina display is
 * as sharp as the screen it was taken from, then reduced until it fits the
 * caps. Small text in a screenshot that has been scaled down is unreadable, and
 * an unreadable screenshot is not evidence of anything.
 */
function outputScale(
  crop: { width: number; height: number },
  devicePixelRatio: number,
): number {
  let scale = Math.min(2, Math.max(1, devicePixelRatio));

  if (crop.width * scale > MAX_OUTPUT_WIDTH) {
    scale = MAX_OUTPUT_WIDTH / crop.width;
  }

  const pixels = crop.width * scale * crop.height * scale;
  if (pixels > MAX_OUTPUT_PIXELS) {
    scale *= Math.sqrt(MAX_OUTPUT_PIXELS / pixels);
  }

  return Math.max(0.5, scale);
}

/** A background colour, unless it is the transparent default. */
function opaque(colour: string): string | null {
  if (!colour) return null;
  if (colour === "transparent") return null;
  if (/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(colour)) return null;
  return colour;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Load the SVG as an image.
 *
 * `onerror` gives no reason, ever -- the usual cause is markup the XML parser
 * refused, which is why the copy carries so few attributes. The timeout is
 * there because a rejected SVG occasionally fires neither event, and a promise
 * that never settles would leave the reviewer looking at a spinner forever.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(
      () => reject(new Error("The picture took too long to draw.")),
      10_000,
    );

    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("The picture could not be drawn from this screen."));
    };
    image.src = src;
  });
}
