# Prototype Review Portal

A private site where I upload HTML prototypes and send reviewers a link. Reviewers
enter a password, pick their name, walk through the prototype with an AI assistant,
annotate it, and leave feedback. I review the feedback in an admin area.

I am a UX designer, not a developer. Explain what you are doing and why in plain
terms. Do not assume I will catch a bad architectural choice.

## Stack
- Next.js (App Router), TypeScript, Tailwind
- Postgres (Vercel Postgres or Neon), Drizzle ORM
- Vercel Blob for uploaded files
- Anthropic API for the assistant, called only from server routes
- Deployed on Vercel from GitHub

## Critical constraint: same-origin prototypes
Prototypes render in an iframe and the parent page must be able to read and modify
the iframe DOM. That only works if the prototype is served from this app's own
origin. Never point the iframe at a Vercel Blob URL directly. Always serve prototype
HTML through a route handler on this domain that fetches from Blob and returns it
with Content-Type: text/html.

## Prototype conventions
- One self-contained HTML file per version
- Screens are div containers with a data-screen="name" attribute, shown and hidden
  with JS. There is no multi-page navigation.

## Security model (deliberately simple)
- Admin: one password in an env var, cookie session. No user accounts.
- Reviewer: per-prototype password, then a name picker. Name is NOT remembered.
  Every visit asks for password and name again.
- No public routes other than the reviewer entry page.

## Data model
prototype   id, name, ticket, description, password_hash, reviewer_names (text[]),
            created_at
version     id, prototype_id, label, changed_note, html_blob_url,
            knowledge_base_text, type ('revision'|'option'), is_current, created_at
task        id, version_id, sort_order, goal, success_state
criterion   id, version_id, ref, text, where_found, verifiable_in_prototype
not_built   id, version_id, text
session     id, version_id, reviewer_name, started_at, completed_at
message     id, session_id, role, content, created_at
annotation  id, session_id, kind ('select'|'point'|'draw'), screen_id,
            css_selector, label, coords_json, screenshot_blob_url, created_at
feedback    id, session_id, annotation_id, screen_id, task_id, criterion_id,
            expected, happened, note, severity, disposition, created_at
ac_result   id, session_id, criterion_id, result, note

severity: 'blocker'|'major'|'minor'|'preference'|'new_request'
disposition: null|'done'|'wont_do'|'deferred'|'needs_discussion'
ac_result.result: 'met'|'not_met'|'needs_discussion'|'not_verifiable'

## Rules
- Server routes hold all secrets. Never expose the Anthropic key to the client.
- Build only what the current chunk asks for. Leave clear TODOs for later chunks
  rather than stubbing half-features.
- Keep it boring. No state management library, no component library beyond Tailwind.

## Design system: Material 3

The UI follows Google's Material Design 3. This does NOT mean adding a component
library -- the "keep it boring" rule still holds. M3 is implemented as design
tokens plus a handful of hand-written components.

- Tokens live in `src/app/globals.css`. The `:root` block holds the raw M3 system
  tokens as CSS custom properties named exactly as the spec names them
  (`--md-sys-color-primary`, `--md-sys-shape-corner-large`, and so on). The
  `@theme inline` block below maps those into Tailwind utilities.
- Colour is the M3 baseline scheme. Light and dark are both defined; dark follows
  the OS setting via `prefers-color-scheme`.
- Always use a colour *role*, never a raw hex or a stock Tailwind colour. Use
  `bg-surface-container text-on-surface`, not `bg-gray-100 text-gray-900`. Every
  container role has a matching `on-` role for content sitting on top of it, and
  pairing them correctly is what keeps contrast accessible.
- Type comes from the M3 type scale: `text-display-*`, `text-headline-*`,
  `text-title-*`, `text-body-*`, `text-label-*`. Each already carries its own
  size, line height, letter spacing, and weight. Do not add `font-bold` on top.
- Shape comes from the shape scale: `rounded-xs|sm|md|lg|xl|full`.
- Elevation comes from `shadow-level1` through `shadow-level5`. In M3, dark mode
  conveys elevation mostly with lighter surface containers rather than heavier
  shadows, so prefer a higher `surface-container-*` role over a bigger shadow.
- Interactive elements need a state layer -- the translucent overlay M3 puts over
  a component on hover, focus, and press. Use the `m3-state-layer` class from the
  components layer in `globals.css` rather than hand-rolling hover colours.
- If you set a surface background on a container that might hold a text field,
  also set `--m3-field-surface` to the same colour role. A floating label paints
  a notch over the field's outline, and that notch has to match whatever is
  behind it. `Card` does this for itself; a layout or a hand-rolled wrapper has
  to say it explicitly.

Hand-written components live in `src/components/m3/`. Add to them rather than
writing one-off styled elements, so later chunks stay consistent.

## Reviewer access
- `/r/[prototypeId]` is the only public route, and the link is permanent: it
  always resolves to whichever version has `is_current` set.
- Two cookies, both scoped per prototype and both signed. The *pass* says this
  browser got the password right; the *session* says which visit this is. A
  pass for one prototype cannot be moved to another, because the prototype id
  is inside the signature.
- The pass cookie deliberately has no `maxAge`, so the browser discards it on
  close and the next visit starts at the password screen.
- The name is never stored anywhere but the session row. Arriving at
  `/r/[prototypeId]` always shows the name step and always starts a new
  session, even when the pass is still valid -- CLAUDE.md requires the name to
  be asked every time. `/r/[prototypeId]/review` is where the reviewer lands
  afterwards, so refreshing the prototype does not re-prompt.
- `/p/[versionId]` is served only to an admin or to a reviewer holding a valid
  pass for that version's prototype. Everyone else gets a 404 rather than a
  403, so nothing is revealed about which versions exist.

## The assistant
- Every call to Claude goes through `/api/chat`. `ANTHROPIC_API_KEY` is read in
  `src/lib/env.ts` and used only there -- it must never reach the browser.
- The system prompt is `prompts/assistant.md` (global, hand-edited) plus
  per-prototype context appended at request time: name, description, knowledge
  base, the not-built list, and whatever this session has already logged. That
  file is bundled into the deployed function
  by `outputFileTracingIncludes` in next.config.ts; a runtime path is invisible
  to Next's dependency tracing, so without that entry it works locally and
  fails in production.
- Editing `prompts/assistant.md` needs a redeploy. It is read once per server
  instance, not per message.
- Replies stream. Every message, in both directions, is written to the
  `message` table, including a partial or failed answer -- the reviewer saw it,
  so the transcript should show it.
- The last `HISTORY_LIMIT` messages are resent on each call to give the
  conversation memory; the constant in `src/app/api/chat/route.ts` says where
  to tune it.
- The assistant has no screen awareness yet. The prompt tells it to ask which
  screen the reviewer means. Chunk 6 replaces that.

## Feedback capture

- **There is no "ask" versus "report" mode.** A reviewer does not know which of
  the two they are doing until they have said it, so making them classify their
  own thought before typing it is the friction this replaces. They type; the
  assistant answers, and calls the `record_feedback` tool for anything that
  reads as a finding.
- The tool is defined in `src/lib/feedback-tool.ts`, and its field descriptions
  are instructions as much as a schema -- Claude reads them, so they carry as
  much weight as `prompts/assistant.md`.
- The route handler writes the row, not the model. Everything arriving from a
  tool call is trimmed and validated exactly like form input, and an item with
  no text in any field is refused back to Claude as a tool error.
- **Undo, not confirm.** Every recorded item leaves a receipt card inline in the
  conversation with a one-click delete and an editable severity. Asking
  permission before each write would put a dialog in the middle of every
  sentence; letting them delete a wrong one costs a click.
- Severity is Claude's guess and the reviewer's correction. Both work from the
  same wording, because `SEVERITY_DESCRIPTIONS` in `src/lib/feedback.ts` is
  rendered into the tool schema *and* shown in the picker.
- What has already been logged goes into the system prompt, not the message
  history -- the transcript says what was *said*, the feedback rows say what was
  *kept*, and they diverge the moment a reviewer deletes something. This is what
  stops the same complaint being logged twice.
- The flag button beside the composer opens a short form that writes directly,
  without Claude. It exists for reviewers who would rather fill something in,
  and so that an Anthropic outage cannot cost a whole review session.
- `/api/chat` streams **newline-delimited JSON**, not plain text, because one
  turn can produce prose and feedback rows and the panel has to tell them apart.
  Events are `{"t":"text","v":"…"}` and `{"t":"feedback","v":{…}}`.
- Reviewer-owned routes (`/api/feedback`, `/api/feedback/[id]`,
  `/api/review/finish`) all scope their WHERE to the session id from the cookie,
  so knowing an item's UUID is not enough to change or delete it.
- "Finish review" is one nullable timestamp, `session.completed_at`. Reopening
  clears it, because a reviewer always remembers a fourth thing right after
  pressing finish and a dead end there pushes them back to email.

## Handing feedback over

- Finishing a review offers a **download**, and that is the point of the finish
  screen rather than an afterthought on it. A reviewer who screenshots things
  on their own has to write the description, remember what they expected, and
  organise it before sending anything; the download is the same work already
  done. If it is not the loudest thing on that screen they fall back to the
  habit it replaces.
- `/api/review/export` returns a zip holding `feedback.html` and `feedback.md`
  -- two files because there are two ways it actually gets sent. The HTML is
  for attaching and prints to PDF from any browser; the Markdown is for pasting
  into a ticket or a chat window, where an attachment is one click too many.
  `?format=md` returns just the text, which is what the copy button uses.
- The report carries the three things a screenshot cannot: structure (severity,
  screen, expected against happened), the conversation, and provenance (which
  prototype, which version, who, when).
- **It carries screenshots**, inline in the HTML and as files in a
  `screenshots/` folder. See "Eyes" below for how they are taken and why they
  are in there twice.
- The HTML is deliberately self-contained and light-only: inline CSS, system
  fonts, no network requests, because it has to open as an email attachment on
  a laptop with no connection. It is a document for printing, not a page that
  should follow the reader's theme.
- `src/lib/zip.ts` is a hand-written ZIP writer, not a dependency, because this
  needs the smallest corner of the format. Its limits (no ZIP64, ASCII names)
  are documented at the top and hold for a feedback export. Its output is
  checked against the system `unzip` in the tests rather than against itself.
- The download does **not** replace the admin area. Feedback is saved either
  way, so a reviewer who closes the tab without downloading has still been
  heard -- the file is a copy to send, not the only channel.

## Admin review

- `/admin/[prototypeId]/feedback` lists everything across all sessions, grouped
  by version.
- Two different orders, deliberately: versions newest-first because the current
  version is what is actionable, items worst-first inside a version because
  reading the page is triage. Group before sorting, or a blocker on an old
  version drags that whole version to the top.
- Filters live in the URL as search params and are rendered as links, so the
  page needs no client JavaScript, the back button works, and a filtered view
  can be sent to someone as a link.
- Disposition saves on change with no save button. Untriaged is drawn as a
  dashed outline and every disposition as a fill -- "won't do" is the quietest
  fill and was indistinguishable from untriaged when both were neutral.
- The page reads every row for the prototype and filters in memory. That is the
  right trade at one designer's scale; when it stops being, push the WHERE down
  and compute the filter counts with a GROUP BY.

## Where things are
- `src/db/schema.ts`          Drizzle schema, all tables from the data model above
- `src/db/index.ts`           Database client (`getDb()`)
- `src/lib/auth.ts`           Admin cookie session (HMAC signed, httpOnly)
- `src/lib/reviewer-auth.ts`  Reviewer pass and session cookies, per prototype
- `src/lib/assistant-context.ts`  Builds the assistant's system prompt
- `src/lib/feedback.ts`       Severity and disposition wording, shared everywhere
- `src/lib/feedback-tool.ts`  The `record_feedback` tool Claude is given
- `src/lib/export-report.ts`  Builds the reviewer's HTML and Markdown report
- `src/lib/zip.ts`            Minimal ZIP writer, no dependency
- `src/lib/reviewer-session.ts`   "Which review session is this, and is it allowed?"
- `src/lib/prototype-eyes.ts` Reading the framed prototype: screens, clicks, names
- `src/lib/element-capture.ts`  Turning part of the framed prototype into a PNG
- `src/lib/annotation.ts`     The shape of a reference, and where its picture lives
- `prompts/assistant.md`      The global assistant instructions, hand-edited
- `src/lib/signing.ts`        HMAC signing shared by both
- `src/lib/password.ts`       Reviewer password hashing (PBKDF2 via Web Crypto)
- `src/lib/prototype-storage.ts`  Everything to do with Vercel Blob
- `src/lib/env.ts`            Reads and validates environment variables
- `src/lib/reviewer-names.ts` Parses the one-name-per-line reviewer textarea
- `src/lib/briefing.ts`       Mode wording, and reading the briefing out of the edit form
- `src/lib/reviewer-role.ts`  The five roles, their wording, and what each changes
- `src/app/p/[versionId]/`    Serves prototype HTML on our own origin
- `src/app/r/[prototypeId]/`  Reviewer entry, and the review page
- `src/app/api/annotation/`   Recording a reference, and serving its picture
- `src/app/admin/(dashboard)/[prototypeId]/edit/`  Editing an existing prototype
- `src/app/admin/(dashboard)/[prototypeId]/feedback/`  Reading and triaging feedback
- `src/middleware.ts`         Protects every /admin route except /admin/login.
                              **Must stay next to `src/app`.** It used to sit at
                              the repository root, where Next.js never looked --
                              which left the whole admin area open to anyone with
                              the URL, silently, with no error in the logs.
                              Next 16 also warns that the file convention is
                              being renamed to `proxy.ts`; still works, but worth
                              doing before the next Next.js upgrade.
- `drizzle/`                  Generated SQL migrations, committed to the repo

## Uploads
- Prototype HTML is stored in Vercel Blob with `access: "private"`, so the file
  cannot be fetched by URL at all. The only way to see it is through
  `/p/[versionId]`, which means the same-origin rule is enforced by the storage
  layer rather than by everyone remembering it.
- **The browser uploads the file straight to Blob**, never through a server
  action. A Vercel function may only receive a 4.5 MB request body, and real
  prototypes go past that easily once images are inlined. `/api/prototype-upload`
  issues a short-lived token scoped to one pathname, one content type and a size
  cap. That route is NOT covered by middleware, so it checks the admin session
  itself -- do not remove that check.
- The blob URL then arrives at the server action as ordinary form data, which
  means it is user input. The action verifies it three ways before writing
  anything: `head` confirms the blob exists in our store, the pathname must
  belong to the prototype id being claimed, and the opening bytes are read back
  to confirm it is HTML. A rejected upload is deleted, so refused files do not
  accumulate.
- Validate uploads in the browser as well as on the server. Not for speed: a
  browser will not let JavaScript put a file back into a file input, and React
  resets uncontrolled fields after a form action. Anything large or long-lived
  belongs in React state rather than in the input -- that is why the prototype
  file input has no `name`.

## Editing a prototype

`/admin/[prototypeId]/edit` changes a prototype that already exists. It is the
same four sections as the create form, so the two read as one screen twice.
Three rules are worth knowing:

- **The reviewer password is only rewritten when a new one is typed.** Leaving
  that field blank keeps the existing hash, so fixing a typo in the description
  can never lock reviewers out by accident. Changing it does not kick out a
  reviewer who is already through the password step -- their pass cookie lasts
  until they close the browser, or eight hours, whichever is sooner.
- **The knowledge base belongs to the version, not the prototype**, so the edit
  form writes it to whichever version has `is_current`. Older versions keep the
  knowledge base they were actually reviewed against, which is what you want
  when you go back and read old feedback.
- **The prototype id is bound to the server action, not posted as a hidden
  field.** Next encrypts bound arguments, so the browser cannot rewrite it to
  point a save at some other prototype.

Replacing the HTML is deliberately *not* here. That is a new version rather than
an edit of this row, and it needs a label, a change note and a move of
`is_current` -- there is a TODO in `edit/actions.ts` describing the shape.

## The briefing

What the assistant is told about a prototype, beyond its name and knowledge
base. Authored at `/admin/[prototypeId]/edit`, assembled into the system prompt
by `src/lib/assistant-context.ts`.

- **Mode lives on the prototype, the rest on the version.** A tasks list and a
  set of criteria describe one uploaded file, so an old version keeps the
  briefing it was actually reviewed against -- the same rule the knowledge base
  already followed. Mode is how you want reviews run, which is not a property of
  a file.
- **Tasks and criteria are independent and both optional.** Criteria with no
  tasks is a design review; tasks with no criteria is a usability test; both is
  the hybrid this application is for. An empty list is left out of the prompt
  entirely rather than sent as an empty heading.
- **The two lists are diffed on save, never replaced.** A reviewer's verdict
  lives in `ac_result` and cascades when its criterion is deleted, so
  delete-all-then-insert would throw away every acceptance result on a version
  the moment you fixed a typo. Rows come back from the form carrying their id,
  which is how a save can update in place. Tasks work the same way even though
  nothing points at them yet, because something will after the next chunk.
- **Row ids from the form are user input.** Every update is scoped to the
  version being edited, so an id belonging to somewhere else matches nothing and
  is written as a new row rather than hijacking another version's.
- **`sort_order` is not decoration.** Without it Postgres may return the lists
  in any order, and the form would reshuffle itself every time it was saved.
- The "cannot be checked in a prototype" checkbox is the inverse of the column
  it writes. The form asks the question the person filling it in is actually
  asking, and unticked is the common case, so the common case needs no action.
  The field is called `notVerifiable` so the inversion is visible where it
  happens rather than hidden behind a name that means the opposite.
- Repeatable rows key on a counter, never on the array index. Keying by index
  is the classic bug here: delete the first of three rows and the remaining text
  appears to jump between fields.

## Prototypes with no assistant

`mode` has a fourth value, `off`, and it is not a degree of the other three.
There is no assistant at all: the reviewer gets the briefing on screen and a
form, and no request is ever made to Anthropic.

- It lives in the same field as the three assistant modes because "how does the
  assistant behave here" is the question somebody is asking when they reach for
  that setting, and "it does not" is a real answer to it.
- `/api/chat` refuses with a 404 when the mode is off. The reviewer is served a
  form rather than a chat so nothing in the browser calls it -- but a route that
  can be called directly has to enforce the setting itself, or "no requests are
  made to Anthropic" is a claim about the UI rather than about the application.
- **The panel is a brief and then a form, in that order.** A feedback box on its
  own collects "looks good". The scenario, the tasks and the criteria are what
  give somebody something specific to react to, which is the whole reason this
  beats an email asking for thoughts.
- The not-built list is shown to the reviewer here, which it is not in an
  assistant review. With an assistant it answers "is that broken or just
  unfinished?" as the question arises; with nobody to ask, saying it up front is
  what stops a reviewer spending their attention on a button that was never
  going to work.
- Every section of the brief disappears when it is empty rather than showing a
  heading with nothing under it.
- **The role picker is hidden.** Role only steers what the assistant asks about
  and nothing else reads it, so with no assistant it is a question whose answer
  reaches nobody. The action still defaults it to "other".
- `ReviewSummary` -- the finish screen and the download -- is shared with the
  assistant panel rather than copied, because a review ends the same way whether
  or not anyone was talking. It lives in its own module so a page with no chat
  does not import the chat machinery to get it.
- Ticking a task off is *not* here. That needs a `task_result` table and belongs
  with the rest of the assistant's hands, so for now the tasks are a read-only
  list and completion is reported in the feedback like anything else.

## The assistant's voice

`prompts/assistant.md` is now the real personality file, not a placeholder. It
decides who the assistant is and how it behaves, and it is the first thing to
edit when the assistant is wrong. Remember it is read once per server instance,
so a change needs a redeploy.

- **The file never lists what the assistant can see or do.** That list is
  generated in `assistant-context.ts` from what is actually wired up, and
  appended. A hand-written capability list goes stale silently, and an
  assistant that believes it can highlight an element will offer to, leaving
  the reviewer waiting for something that never happens. When a later chunk
  lands, lines move from the "cannot yet" list to the "can" list and the prompt
  is right the same day.
- **Starter chips sit above the composer, not in an empty state.** Since the
  assistant speaks first there is no empty state to put them in -- the panel
  asks for an opening the moment it loads, so the conversation is never empty.
  They are built from what the version actually has, because offering "what am
  I meant to try?" on a prototype with no tasks earns a shrug, and they clear
  once the reviewer has said something of their own.
- **The assistant speaks first.** The panel asks for an opening when it loads
  into an empty conversation, unless there is no API key -- then it shows the
  empty state rather than greeting the reviewer with a failed request. There is no reviewer message to answer, so the
  model is given a stage direction that is never persisted and never shown --
  the transcript starts with the assistant talking, which is the point. The
  server refuses a second opening once anything has been said, so a reload
  mid-review returns to the conversation rather than greeting you again.
- **Role is picked after the name, and defaults to "None of these".** A
  required picker with no default is one more thing between a reviewer and the
  prototype, and "other" is the answer that assumes least: plain language, no
  jargon. It changes what the assistant asks about, never how hard it pushes --
  that is the prototype's mode.
- Role wording lives in `src/lib/reviewer-role.ts` because the same sentences
  are shown to the reviewer *and* given to the assistant. Two copies of one
  instruction is two things to keep in step, and the one nobody reads is the
  one that drifts.

## Confirming feedback

Chunk 5 saved immediately and offered an undo. The personality file overrides
that: nothing is written until the reviewer says so.

- The tool is `propose_feedback` and it **writes nothing**. It validates the
  call, gives it an id for the browser to key on, and returns a card. The Save
  button on that card is what writes the row, through `/api/feedback` -- the
  same route the manual form uses, so anything reaching the database has been
  validated on the way out of the model and again on the way in.
- A draft lives only in the browser. A refresh loses it, and that is correct:
  an unanswered question is not a record of anything.
- A draft is drawn with a dashed edge and says "Not saved yet" in words. A card
  that has not been agreed to must never look like one that has.
- The reviewer can change the severity on a draft but not the wording. The
  wording is what they said; a draft they do not recognise should be discarded
  and said again rather than edited into shape.
- The assistant is told not to ask "shall I log that?" and wait. It proposes
  and carries on. **The card is the question.**
- `# Already recorded this session` in the prompt is built from the feedback
  table, so it lists saved items only. A discarded draft was never there, and
  the assistant is free to propose the point again if the reviewer raises it
  differently.

## Eyes

The review page can read the framed prototype. This is the payoff for the
same-origin rule: `iframe.contentDocument` is readable only because
`/p/[versionId]` serves the file from our own domain, and everything below
falls out of that one fact.

Three things, in order of how much they cost.

- **Which screen is showing.** Free, and always on. `currentScreen` looks for
  `data-screen`, then `data-screen-label`, then a visible `<section id>`, and
  picks the largest visible one. It accepts both attributes because the
  convention says one thing and the first real prototype did the other, and a
  detector that only understands the documented spelling detects nothing. It is
  re-read from a MutationObserver plus a poll for the first eight seconds,
  because a bundled app paints about a second after the frame fires `load`.
- **The path.** Every click, with the element's name and whether anything in the
  document changed within 400ms. Kept in the browser, in a ref, and sent as a
  short digest with each message -- there is no table for it, and a reviewer
  who closes the tab leaves nothing behind. Timing is recorded and never shown,
  exactly as this file said it would be.
- **A reference.** The reviewer presses the target button and clicks something.
  That takes a picture, writes an `annotation` row, and the next feedback item
  they save picks it up.

Some rules that are easy to break later:

- **Nothing writes to the framed document.** Not one attribute, not one style.
  It is somebody's finished artefact and a review must not be able to change
  what it is reviewing. The hover highlight during pointing is a div in the
  parent, positioned over the top.
- **`instanceof` does not work on nodes in the frame.** Every document has its
  own copy of every DOM class, so `node instanceof Element` is false for every
  element in the prototype -- silently, with no error. The first version of the
  capture used it as a sanity check and every capture failed with "there was
  nothing to capture". Compare `tagName` and `nodeType` instead.
- **Pointing is done with an overlay, not by listening for clicks.** A
  transparent sheet over the iframe takes the mouse, and the element under the
  pointer is found with `elementFromPoint`. The prototype therefore never
  receives the click at all, so choosing what to point at cannot submit a form
  or navigate away from the thing being pointed at.
- **The click step is emitted before we know whether it was dead**, and the
  answer is written onto the same object 400ms later. Waiting first would put
  the click *after* the screen change it caused, and label it with the screen it
  arrived at rather than the one it was made on.

### The picture

`src/lib/element-capture.ts` builds an SVG whose `<foreignObject>` holds a copy
of the document with every computed style inlined, hands it to an `<img>`, and
paints that onto a canvas. It is written out rather than taken from a library
because the element lives in *another document* and the usual libraries read
computed styles from the wrong window, which produces a stack of unstyled text
that looks enough like an answer to be mistaken for one.

It is a crop around the element with a red rectangle drawn on it, not a picture
of the element alone: a button on its own tells you nothing, and where it sits is
the whole point. The rectangle is stroked onto the canvas afterwards so no style
in the prototype can affect it and no `overflow: hidden` can clip it.

Its limits are listed at the top of that file and all of them are silent -- the
picture comes out with the missing part missing. The important ones: images
loaded from another site do not appear, web fonts fall back to the system font,
and `::before`/`::after` are not copied. That is a property of rendering SVG in
an `<img>`, which refuses every external reference. A prototype that inlines its
images as `data:` URIs, which is what "one self-contained HTML file" means here,
is unaffected.

### Where a picture goes

- Stored in Blob privately, like everything else, and served only through
  `/api/annotation/[id]/image`. That route answers the admin, and the reviewer
  whose *session* the annotation belongs to. Not "a reviewer of this prototype":
  holding the password is not the same as having taken the picture.
- The browser posts the PNG to `/api/annotation` as multipart form data, which
  is the opposite of how prototype HTML is uploaded. Deliberate: a prototype can
  be tens of megabytes and a crop of one screen is a few hundred kilobytes, so
  the direct-to-Blob token dance buys nothing here.
- In the report it appears twice. Inline in the HTML as a data URI, because the
  file has to open as an email attachment with no network and a
  `src="screenshots/.."` is a broken image the moment somebody forwards the HTML
  on its own; and as a real file in `screenshots/` in the archive, because a
  designer wants to drag one into a ticket. `?format=md`, which is the copy
  button, carries neither -- it says a screenshot exists and where to find it,
  because a broken image link in a pasted ticket looks like a mistake.
- On `/admin/[prototypeId]/feedback`, above the words.

### What the assistant does with it

The screen, the path and the pending reference are sent with each message and
appear as `# Where they are right now`. The instruction attached to them is to
use it and not to recite it: knowing which screen somebody is on is for asking a
better question, not for telling them where they are. The generated capability
list moved four lines from "cannot see" to "can see" the day this landed, which
is the whole reason that list is generated.

The assistant cannot take a picture itself. It can ask the reviewer to point at
something, and "point at it" -- which the personality file has always said -- is
now a real instruction with a button behind it.

## Build progress
Built so far: chunks 1 (foundation), 2 (upload and same-origin serving),
3 (reviewer entry and prototype render), 4 (the assistant), 5 (feedback capture,
admin review and the reviewer's downloadable report), admin editing
(`/admin/[prototypeId]/edit`), the briefing, the new voice, and the eyes.

## Where this is going

The plan then changed direction, and the direction is now set by one document:
`prompts/assistant.md`, which describes an assistant with a personality, a mode,
and a job. Everything from here is built to make that file true.

The job is a hybrid. A prototype review is part product-owner sign-off ("does
this do what the ticket asked") and part usability test ("could a person
actually do it"), and the same session has to serve both. That is why the
report carries acceptance criteria *and* tasks *and* the path the reviewer
took, and why any of those sections may be absent.

**The one thing a review must capture is the gap between what a reviewer
expected and what happened.** Every design decision from here answers to that:
the assistant asks before they click rather than after, the report is built
around expected-against-got, and severity is a stripe rather than a heading so
a blocker never reads like a nitpick.

Remaining work, in dependency order:

1. ~~**The briefing.**~~ Done. Mode, scenario, tasks, acceptance criteria and
   the not-built list are authored in the edit form and reach the assistant.
2. ~~**The new voice.**~~ Done. The personality file, the role picker, the
   opening message, and confirm-before-save.
3. ~~**Eyes.**~~ Done. Screen detection, the path through the prototype, and
   pointing at an element to put a picture of it in the report. Timing is
   recorded because the "stalled" signal needs it, and never shown.
4. **Hands.** Mark a task done, set a criteria result, flag a question, and
   highlight an element. All of the first three confirm before saving.
   Highlighting is the one the eyes have already paid for: the annotation row
   stores a CSS selector precisely so an element can be found again.
5. **Instincts.** Speaking unprompted on a strong signal, rate limited.
6. **The handover.** The assistant writes the closing summary and the report is
   rebuilt around the expectation gap.

Two standing rules for all of it. Feedback is **confirmed before it is saved**,
not saved and undone -- chunk 5 chose the opposite and the personality file
overrides it. And every screen follows **Material 3**, using the tokens in
`src/app/globals.css`, including the downloadable report, which inlines them
because it has to open with no network.

## Note on real prototypes
The first real prototype put through this marks its screens with
`data-screen-label`, not the `data-screen` attribute assumed above, and renders
as a bundled app rather than plain show/hide divs. Both of those are handled --
`src/lib/prototype-eyes.ts` accepts either attribute and keeps looking for eight
seconds after `load`, because the content appears a second or so later. Keep
that in mind when adding anything else that reads the frame: the honest
assumption is that a prototype arrives however it arrives, and reading it once
on `load` reads an empty page.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
