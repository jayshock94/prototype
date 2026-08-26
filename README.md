# Prototype Review Portal

A private site for putting HTML prototypes in front of reviewers and collecting
structured feedback. You upload a prototype, send reviewers one link, and they
walk through it with an AI assistant that captures what they say.

This README is written for someone who is not a developer. Follow it top to
bottom and you will have it running.

## What exists right now

This is **chunk 2 of 10**. Working today:

- Next.js app with the Material 3 design system
- The full database schema, all ten tables
- Admin sign-in with a single password
- Upload a prototype: name, ticket, description, reviewer password, reviewer
  names, the HTML file, and a knowledge base
- Prototypes served from this app's own domain at `/p/<versionId>`
- An admin dashboard listing prototypes, and a detail page per prototype

Not built yet: the reviewer side, the assistant, annotation, tasks and
acceptance criteria, and versions. Those are chunks 3 through 10 in
`claudecodebuildprompts.md`.

---

## Part 1: Run it on your own machine

### 1. Install the dependencies

You need [Node.js](https://nodejs.org) 20 or newer. Check with `node -v`.

```bash
npm install
```

### 2. Get a database

The easiest option is [Neon](https://neon.tech) — free, and it works the same
locally and on Vercel.

1. Sign up and create a project.
2. On the project dashboard find **Connection Details**.
3. Copy the **pooled** connection string. It looks like
   `postgresql://user:pass@ep-something-pooler.region.aws.neon.tech/neondb?sslmode=require`.

Pooled matters. The app runs as many short-lived serverless functions, and the
pooled endpoint is what stops them exhausting the database's connections.

### 3. Get a file store

Uploaded prototype HTML goes to Vercel Blob.

1. In the Vercel dashboard go to **Storage → Create → Blob**.
2. Connect the store to this project.
3. Install the CLI (`npm i -g vercel`), run `vercel link` once to connect this
   folder to the project, then `vercel env pull` to copy the credentials into
   `.env.local`.

That gives you `BLOB_READ_WRITE_TOKEN`. Uploading will not work without it — the
new-prototype page says so plainly rather than failing on submit.

### 4. Create your settings file

If `vercel env pull` already made `.env.local`, just add the missing values.
Otherwise:

```bash
cp .env.example .env.local
```

Open `.env.local` and set:

- `DATABASE_URL` — the connection string you copied from Neon
- `ADMIN_PASSWORD` — your admin password. Generate a good one with
  `openssl rand -base64 24`
- `BLOB_READ_WRITE_TOKEN` — from `vercel env pull`

### 5. Create the database tables

```bash
npm run db:migrate
```

This runs the SQL in `drizzle/` against your database. It prints what it is
about to do before doing it. Run it once now, and again any time a later chunk
changes the schema.

### 6. Start it

```bash
npm run dev
```

Open <http://localhost:3000>. You will be sent to the sign-in page. Enter your
`ADMIN_PASSWORD` and you should land on an empty prototype list.

Click **New prototype**, fill it in, and upload a self-contained HTML file. You
land on the prototype's detail page with an **Open v1** button, which opens the
prototype at a URL on your own domain.

**That is chunk 2 done.** The reviewer link shown on the detail page does not
work yet — that is chunk 3.

---

## Part 2: Put it on the internet

### 1. Push to GitHub

The repository is already set up. Commit and push your branch.

### 2. Import into Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New → Project**, and pick this repository.
3. Vercel detects Next.js on its own. Do not change the build settings.
4. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | your pooled Neon connection string |
   | `ADMIN_PASSWORD` | your admin password |

   Add both to Production, Preview, and Development. `BLOB_READ_WRITE_TOKEN` is
   added for you when you connect the Blob store to the project.

5. Deploy.

### 3. Create the tables on the production database

If you used the same Neon database locally, the tables are already there and
you can skip this.

If production uses a different database, point `DATABASE_URL` in your local
`.env.local` at it temporarily and run `npm run db:migrate` again.

### 4. Check it

Visit your Vercel URL. You should get the sign-in page, and your password
should get you to the empty dashboard.

---

## Environment variables

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. Use the pooled one. |
| `ADMIN_PASSWORD` | Yes | The only admin credential. No accounts, no reset. |
| `SESSION_SECRET` | No | Signs the admin cookie. Derived from `ADMIN_PASSWORD` if unset. |
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob, for uploaded prototype files. |
| `ANTHROPIC_API_KEY` | Chunk 4 | The assistant. Server-side only, never sent to the browser. |

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run locally with hot reload |
| `npm run build` | Production build — worth running before you push |
| `npm run typecheck` | Check types without building |
| `npm run lint` | Check code style |
| `npm run db:generate` | Turn schema changes into a new SQL migration |
| `npm run db:migrate` | Apply migrations to the database |
| `npm run db:studio` | Browse your data in a web UI |

Use `db:generate` then `db:migrate` — never `db:push` on a database with real
data in it, because push works out the changes on the fly rather than from a
reviewed migration file.

---

## How it is put together

```
src/
  app/
    admin/
      (dashboard)/        Signed-in admin pages and their shared chrome
        page.tsx          The prototype list
        new/              Upload form and the action that creates a prototype
        [prototypeId]/    One prototype: its details and its versions
      login/              Sign-in page — deliberately outside (dashboard)
      auth-actions.ts     Sign in and sign out
    p/[versionId]/        Serves prototype HTML on our own origin
    globals.css           Material 3 tokens. The design system lives here.
    layout.tsx            Root layout, loads Roboto
  components/m3/          Hand-written Material 3 components
  db/
    schema.ts             All ten tables
    index.ts              Database connection
  lib/
    auth.ts               Admin cookie session, signed so it cannot be forged
    password.ts           Reviewer password hashing
    prototype-storage.ts  Everything to do with Vercel Blob
    env.ts                Environment variables, read in one place
drizzle/                  Generated SQL migrations — commit these
middleware.ts             Blocks every /admin route without a valid session
```

### Why prototypes are served from `/p/<versionId>`

The review page shows a prototype in an iframe, and later chunks need the page
around it to read and change what is inside that iframe — to know which screen
you are on, to outline a button the assistant is talking about. Browsers only
allow that when the iframe's contents come from the same domain as the page.

A Vercel Blob URL is a different domain. Pointing the iframe straight at Blob
would look fine and then fail the moment anything tried to touch the prototype.
So the file is fetched on the server and re-served from this app's own domain.

The files are stored as **private** blobs, which means they cannot be fetched
from Blob at all without the store's secret token. `/p/<versionId>` is the only
way in. That turns the rule into something the storage enforces rather than
something everyone has to remember.

### Why the admin login page sits outside `(dashboard)`

A folder in parentheses is a *route group*: it organises files without becoming
part of the URL. `src/app/admin/(dashboard)/page.tsx` is still `/admin`.

The point is that `(dashboard)/layout.tsx` — the app bar with the sign-out
button — only wraps pages inside that group. The login page is outside it, so a
signed-out visitor does not get admin chrome and a "Sign out" button on the
sign-in screen. Add new signed-in admin pages inside `(dashboard)`.

### Security, briefly

- One admin password in an environment variable. No accounts.
- The session cookie is `httpOnly`, so page JavaScript cannot read it, and it
  carries a signature the server checks — setting a cookie by hand does not get
  anyone in.
- Sessions last 12 hours.
- `middleware.ts` runs before any `/admin` page, so a page added later is
  protected automatically rather than needing to remember its own check.
- The root URL redirects to `/admin`. There is no public landing page.

### The Material 3 design system

Material 3 is implemented as design tokens rather than a component library, so
there is nothing new to learn or keep updated. `src/app/globals.css` holds the
colour roles, type scale, shape scale and elevation levels, and turns them into
Tailwind utilities.

Practical version: use `bg-surface-container text-on-surface` rather than
`bg-gray-100 text-gray-900`, and `text-title-medium` rather than
`text-base font-semibold`. Every colour role has a matching `on-` role for
content on top of it, and pairing them keeps contrast correct in both light and
dark. Dark mode follows the operating system and needs no extra work.

To rebrand, generate a scheme in the
[Material Theme Builder](https://material-foundation.github.io/material-theme-builder/)
and replace the hex values in the two colour blocks in `globals.css`. Nothing
else needs to change.

---

## Troubleshooting

**"The database is not connected yet" on the dashboard.** Expected when
`DATABASE_URL` is missing or wrong, or before `npm run db:migrate` has run. The
page shows the underlying error — sign-in working means the app is fine and only
the database connection is not.

**Sign-in rejects the right password.** Check `.env.local` for stray quotes or
trailing spaces, and restart `npm run dev` — environment variables are only read
at startup.

**Signed out unexpectedly.** Sessions last 12 hours. Changing `ADMIN_PASSWORD`
also signs you out everywhere unless you have set `SESSION_SECRET`.

**Too many database connections.** You are on the direct connection string
rather than the pooled one.

**"File storage is not connected yet" on the new-prototype page.**
`BLOB_READ_WRITE_TOKEN` is missing. See step 3 above.

**The upload form cleared my file when it showed an error.** Browsers do not let
a site put a file back into a file picker, and React clears the other fields
after a submit, so the file and the reviewer password have to be entered again.
Most mistakes are caught before that happens — the wrong kind of file, or one
that is too big, is rejected the moment you choose it.

**"That file is too large."** The limit is 4 MB, because Vercel caps what a
server function can receive. If your prototypes are routinely bigger, that is
worth telling me — it needs a different upload route, not a bigger number.
