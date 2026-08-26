# Prototype Review Portal

A private site for putting HTML prototypes in front of reviewers and collecting
structured feedback. You upload a prototype, send reviewers one link, and they
walk through it with an AI assistant that captures what they say.

This README is written for someone who is not a developer. Follow it top to
bottom and you will have it running.

## What exists right now

This is **chunk 1 of 10** — the foundation. Working today:

- Next.js app with the Material 3 design system
- The full database schema, all ten tables
- Admin sign-in with a single password
- An admin dashboard listing prototypes (empty until chunk 2 adds uploading)

Not built yet: uploading prototypes, the reviewer side, the assistant,
annotation, and versions. Those are chunks 2 through 10 in
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

### 3. Create your settings file

```bash
cp .env.example .env.local
```

Open `.env.local` and set two values:

- `DATABASE_URL` — the connection string you just copied
- `ADMIN_PASSWORD` — your admin password. Generate a good one with
  `openssl rand -base64 24`

### 4. Create the database tables

```bash
npm run db:migrate
```

This runs the SQL in `drizzle/` against your database. It prints what it is
about to do before doing it. Run it once now, and again any time a later chunk
changes the schema.

### 5. Start it

```bash
npm run dev
```

Open <http://localhost:3000>. You will be sent to the sign-in page. Enter your
`ADMIN_PASSWORD` and you should land on an empty prototype list.

**That is chunk 1 done.** An empty list is the correct result — there is no way
to add a prototype until chunk 2.

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

   Add both to Production, Preview, and Development.

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
| `BLOB_READ_WRITE_TOKEN` | Chunk 2 | Vercel Blob, for uploaded prototype files. |
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
      login/              Sign-in page — deliberately outside (dashboard)
      auth-actions.ts     Sign in and sign out
    globals.css           Material 3 tokens. The design system lives here.
    layout.tsx            Root layout, loads Roboto
  components/m3/          Hand-written Material 3 components
  db/
    schema.ts             All ten tables
    index.ts              Database connection
  lib/
    auth.ts               Cookie session, signed so it cannot be forged
    env.ts                Environment variables, read in one place
drizzle/                  Generated SQL migrations — commit these
middleware.ts             Blocks every /admin route without a valid session
```

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
