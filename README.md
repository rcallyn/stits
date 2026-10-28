# stits

[![CI](https://github.com/rcallyn/stits/actions/workflows/ci.yml/badge.svg)](https://github.com/rcallyn/stits/actions/workflows/ci.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black)
![React 19](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Postgres](https://img.shields.io/badge/Postgres-Supabase-336791)

A full-stack, multi-user calendar and todo app I use every day. It puts my
week and my task list on one dashboard, adds items from plain English
("dentist tomorrow at 3pm"), pulls my school deadlines from Canvas, and
sends a push notification each morning with the day's plan. Other people
can request their own account, which I approve from inside the app.

It's deployed on Vercel with a Postgres database and has been my daily
planner since July 2026.

**Try it without an account:** the sign-in page links to a demo (`/demo`)
with a sample student's week: classes, a campus job, club soccer, robotics,
choir and chores. Everything works on the sample data, which lives only in
that browser tab. Nothing is sent to the server, and quick add uses a simple
offline parser instead of Claude.

![Dashboard — week view with todos, sample data](docs/dashboard-demo.png)
<sub>Sample data shown above, not my real todos or schedule.</sub>

## How it was built

I designed the product, made the architecture and security decisions, and
reviewed and tested every change. The code itself was written by Claude,
Anthropic's AI coding assistant, working from my direction. I wrote the
specs, broke the work into commits, caught bugs by using the app on my
phone and laptop every day, and decided what shipped.

Over about three months that came to ~9,400 lines of TypeScript in more than
60 commits, with continuous integration on every push.

## Features

- **Calendar and todos side by side.** Day and week views next to the task
  list, with a resizable sidebar on desktop and a native-style tab bar on
  mobile.
- **Drag a todo onto the calendar to schedule it**, with a mouse or by touch.
  Drop it on a day for an all-day item, or on a time slot for a 15-minute
  event. There's also a keyboard path for doing the same thing.
- **Natural-language quick add.** Typing "lab report due Friday" or "coffee
  with Sam tomorrow 10–11am" makes a todo or an event with the right date
  and time. Claude parses the text into a typed, validated structure.
- **Rich todos and events.** Notes, subtasks, priority, color-coded
  categories, due dates with overdue warnings, recurring events (daily,
  weekly, monthly, with skipped dates) and multi-day events.
- **Canvas LMS sync.** Reads a course calendar feed (iCalendar) and turns
  assignments into todos plus calendar entries. It runs daily on the server,
  updates changed items, and remembers deletions so they don't come back.
- **7am daily digest.** A push notification with today's schedule, what's
  due, and a quote, for every user who has added a Pushover key.
- **Search palette** across all todos and events, with jump-to-date.
- **Installable PWA** on iOS and desktop, with light, dark and
  follow-the-system themes.
- **Accounts.** Anyone can request an account at `/signup`. Admins with a
  Pushover key get a push alert for each request, and approve or reject it
  under Other → Users.
  Every user's todos, events, categories and Canvas feed are their own, and
  each user can change their password or add a Pushover key (for 2FA and
  the digest) under Other → Account.
- **Backup export and import** as a JSON file.

## Tech stack

| Layer      | Choices |
| ---------- | ------- |
| Frontend   | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend    | Next.js route handlers on Vercel serverless functions |
| Database   | PostgreSQL (Supabase) through `postgres.js` with a pooled connection |
| AI         | Anthropic Claude API with structured output for quick add |
| Validation | Zod schemas on every API request body |
| Auth       | Email + password accounts with admin approval, scrypt hashing, HMAC-signed cookies, optional push-notification 2FA |
| Jobs       | Vercel Cron for the daily digest and Canvas sync |
| Testing/CI | Vitest (176 unit tests), ESLint, `tsc` and a production build on every push via GitHub Actions; Dependabot for weekly updates |

## Engineering highlights

**Security.** The app holds personal data and is on the public internet, so
I treated it like a production service:

- **Per-user data isolation:** every row carries a `user_id`, and every
  route checks the session against the `users` table and scopes its queries
  to that user, so a removed account is locked out at once even with a
  validly signed cookie.
- **Approval-gated signup:** new accounts can't sign in until an admin
  approves them, which also keeps strangers off the paid Claude API. Signup
  replies the same way for new and existing emails, and login does equal
  scrypt work for unknown emails, so neither reveals who has an account.
- **Two-step login:** a password checked against a salted scrypt hash in
  constant time, then (for users who've added a Pushover key) a one-time
  code sent by push notification. The short-lived cookie that bridges the
  two steps holds only an HMAC of the code, never the code itself.
- **Revocable sessions:** session cookies carry a version number that's
  checked on every request. Changing your password bumps it, which signs
  out every other device. Changing the password or the Pushover key also
  asks for the current password, so a stolen session can't take the
  account over.
- **Brute-force limits** on both login steps and on signup, stored in
  Postgres so they hold across serverless cold starts. Password guesses are
  limited per client IP (one that can't be spoofed through
  `X-Forwarded-For`) and per account, and a successful login never resets
  the counter, so an attacker can't clear it by signing in to their own
  account between guesses.
- **Strict Content Security Policy** with a fresh nonce on every request (no
  `unsafe-inline` scripts), plus the usual hardening headers.
- **Database lockdown:** row-level security is on and Supabase's default
  public grants are revoked on every table. The app only reaches the
  database through its own server connection, so the auto-generated REST API
  exposes nothing.
- **Every request body is validated with Zod.** The one destructive endpoint,
  "replace all data", requires an explicit confirmation string.

**Reliability and UX.**

- **Optimistic updates with automatic rollback.** All three data stores share
  one generic store built on `useSyncExternalStore`. A write updates the UI
  at once, then re-syncs with the server; a failed write shows a toast and
  rolls the UI back.
- **Time zones and DST.** Vercel Cron only runs on fixed UTC times, so the
  digest is scheduled twice and only the run that lands on 7am Eastern does
  anything.
- **One cron run for every user.** The daily job syncs every user's Canvas
  feed concurrently, then sends each digest; one user's slow or broken
  feed is logged and doesn't cost anyone else their digest.
- **A deliberately limited service worker.** It caches only immutable build
  assets. An earlier version that served an offline page showed "you're
  offline" to users who were online behind VPNs and antivirus proxies, so I
  removed that behavior.
- **Typed AI output.** Quick add asks Claude for JSON that must match a Zod
  discriminated union (event or todo), so a bad response can't reach the
  database. This needed a fix in how the SDK generates the JSON schema; the
  details are in `src/lib/quickAdd.ts`.

**Testing.** Unit tests cover the pure logic where bugs would be hardest to
see: recurrence expansion, iCalendar parsing, Canvas sync, session and 2FA
cookie signing, password hashing, rate limiting, request schemas, the
quick-add output schema and the optimistic store.

## Architecture

```
Browser (React 19, PWA)
  │  optimistic entity stores → fetch /api/*
  ▼
Next.js on Vercel
  ├─ proxy.ts         session signature check + per-request CSP nonce
  ├─ /api/*           Zod-validated, user-scoped route handlers
  ├─ /api/signup      pending accounts, approved under Other → Users
  ├─ /api/quick-add   → Claude API (structured output)
  └─ /api/cron/*      daily digest + Canvas sync (Vercel Cron)
        │                    │
        ▼                    ▼
  Postgres (Supabase)   Pushover (2FA codes, digest, signup alerts)
  RLS on, no public grants
```

```
src/
  app/         pages and API route handlers
  components/  UI: calendars, modals, quick add, search palette
  hooks/       client data stores and UI state
  lib/         domain logic (schedule, todos, ics, canvasSync), auth, db, schemas
  proxy.ts     auth gate and security headers
scripts/       admin setup and migration, database backup, password hashing
schema.sql     database schema, RLS and grants
```

## Running it locally

```bash
npm install
cp .env.example .env.local          # then fill in the values below
# create the schema once against your database:
psql "$DATABASE_URL" -f schema.sql
# create your admin account from OWNER_EMAIL + APP_PASSWORD_HASH:
node --env-file=.env.local scripts/migrate-multi-user.mjs
npm run dev
```

### Upgrading a single-user database

Earlier versions had one shared password and no accounts. Set
`OWNER_EMAIL` in `.env.local` alongside your existing `APP_PASSWORD_HASH`
and `PUSHOVER_USER_KEY`, back up the database, then run the same script
against it:

```bash
node --env-file=.env.local scripts/backup-db.mjs
node --env-file=.env.local scripts/migrate-multi-user.mjs
```

It creates your account as an admin, assigns all existing data to it, and
is safe to re-run. The old code can't read the migrated database and the
new code can't read the old one, so run the script and deploy back to back.
Everyone is signed out once and signs back in with email and password.

### Environment variables

| Variable             | Required | What it's for                                      |
| --------------------- | -------- | --------------------------------------------------- |
| `DATABASE_URL`        | yes      | Your Postgres connection string.                     |
| `SESSION_SECRET`      | yes      | Any random string; keeps login sessions secure.      |
| `OWNER_EMAIL`         | setup    | The first admin's email, read only by `scripts/migrate-multi-user.mjs`. |
| `APP_PASSWORD_HASH`   | setup    | The first admin's password hash, read only by the migration script. Generate one with `node scripts/hash-password.mjs '<password>'`. |
| `ANTHROPIC_API_KEY`   | yes      | Powers the natural-language quick add.               |
| `PUSHOVER_APP_TOKEN`  | yes      | Sends login codes, the daily digest and signup alerts. Each user adds their own Pushover user key in the app. |
| `PUSHOVER_USER_KEY`   | setup    | The first admin's Pushover user key, read only by the migration script. |
| `CRON_SECRET`         | no       | Only needed if you want the daily digest and Canvas sync to run. |

"setup" variables are only needed in `.env.local` when you run the
migration script, not in the deployed app.

### Useful commands

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Starts the app locally.             |
| `npm run build`     | Builds it for production.           |
| `npm test`          | Runs the tests in watch mode.       |
| `npm run test:run`  | Runs the tests once.                |
| `npm run lint`      | Lints the code.                     |
| `npm run typecheck` | Type-checks without building.       |

### Scripts

The first two read the database settings from `.env.local`:
`node --env-file=.env.local scripts/<name>.mjs`.

| Script                            | What it does |
| --------------------------------- | ------------ |
| `scripts/migrate-multi-user.mjs`  | Creates the first admin account; on an older database, also upgrades it to multi-user. Safe to re-run. |
| `scripts/backup-db.mjs`           | Read-only: saves every table to a JSON file in `.backups/` (git-ignored). |
| `scripts/hash-password.mjs`       | Prints an `APP_PASSWORD_HASH` for a password, so the plaintext isn't stored: `node scripts/hash-password.mjs '<password>'`. |
