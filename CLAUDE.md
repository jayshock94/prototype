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
            css_selector, coords_json, screenshot_blob_url, created_at
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

## Where things are
- `src/db/schema.ts`          Drizzle schema, all tables from the data model above
- `src/db/index.ts`           Database client (`getDb()`)
- `src/lib/auth.ts`           Admin cookie session (HMAC signed, httpOnly)
- `src/lib/password.ts`       Reviewer password hashing (PBKDF2 via Web Crypto)
- `src/lib/prototype-storage.ts`  Everything to do with Vercel Blob
- `src/lib/env.ts`            Reads and validates environment variables
- `src/app/p/[versionId]/`    Serves prototype HTML on our own origin
- `middleware.ts`             Protects every /admin route except /admin/login
- `drizzle/`                  Generated SQL migrations, committed to the repo

## Uploads
- Prototype HTML is stored in Vercel Blob with `access: "private"`, so the file
  cannot be fetched by URL at all. The only way to see it is through
  `/p/[versionId]`, which means the same-origin rule is enforced by the storage
  layer rather than by everyone remembering it.
- A server action carries the upload, so it is bounded by Vercel's 4.5 MB limit
  on a function's request body. `MAX_PROTOTYPE_BYTES` reflects that. If
  prototypes outgrow it, switch to `@vercel/blob/client`, which uploads straight
  from the browser.
- Validate uploads on the client as well as the server. Not for speed: a browser
  will not let JavaScript put a file back into a file input, so a form that
  round-trips with an error has silently lost the user's file. React also resets
  uncontrolled fields after a form action, which clears the password too. Catch
  what you can at selection time; the server still re-checks everything.

## Build progress
Built so far: chunks 1 (foundation) and 2 (upload and same-origin serving).
Next up: chunk 3 (reviewer entry and prototype render).
