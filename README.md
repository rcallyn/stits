# stits

A single-user productivity app: schedule / calendar, todos, and notes on one
dashboard, with Canvas calendar sync and natural-language quick-add.

## Stack

- **Next.js 16** (App Router, React 19) — note this repo tracks a modified
  Next build; see `AGENTS.md`.
- **Postgres** (Supabase), accessed directly with `postgres.js` — the Supabase
  client and its auto-generated REST API are not used.
- **Tailwind CSS v4**.
- **Zod** for API input validation and the quick-add structured output.
- **Anthropic SDK** (`claude-haiku-4-5`) for quick-add parsing.
- **Pushover** for the login second factor.

## Architecture notes

- **Single tenant.** There are no `user_id` columns; the whole app sits behind
  one shared password + a Pushover push code. Auth is a signed
  (`SESSION_SECRET`) HMAC cookie checked in `src/proxy.ts` — this Next build
  calls middleware "proxy", so the file is `src/proxy.ts`, not
  `middleware.ts`.
- **Client data layer.** `src/lib/createEntityStore.ts` backs `useTodos`,
  `useNotes`, and `useScheduleEvents`: an in-memory cache hydrated once from
  the API, optimistic writes, a full refetch after every mutation, and an
  error toast (with rollback via that refetch) when a write fails.
- **API routes** all validate their request body with a schema from
  `src/lib/schemas.ts` before touching the database.
- **Security headers.** `src/proxy.ts` sets a per-request nonce-based CSP;
  `next.config.ts` sets HSTS, `X-Frame-Options`, `Permissions-Policy`, etc.

## Local setup

```bash
npm install
cp .env.example .env.local          # then fill in the values below
# create the schema once against your database:
psql "$DATABASE_URL" -f schema.sql
npm run dev
```

### Environment variables

| Variable             | Required | Notes                                                                                                  |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`       | yes      | Postgres connection string. **Use the Supabase transaction pooler** (`*.pooler.supabase.com`, port `6543`), not the direct `5432` connection — the client is configured for a pooled, `prepare: false` setup. |
| `SESSION_SECRET`     | yes      | Random string; signs the session and pending-2FA cookies.                                             |
| `APP_PASSWORD`       | \*       | Plaintext login password. Optional if `APP_PASSWORD_HASH` is set.                                     |
| `APP_PASSWORD_HASH`  | \*       | Preferred. `scrypt$…` digest from `node scripts/hash-password.mjs '<password>'`. Takes precedence over `APP_PASSWORD`. |
| `ANTHROPIC_API_KEY`  | yes      | For `/api/quick-add`.                                                                                  |
| `PUSHOVER_APP_TOKEN` | yes      | Sends the login code.                                                                                  |
| `PUSHOVER_USER_KEY`  | yes      | Recipient of the login code.                                                                           |

\* Set at least one of `APP_PASSWORD` / `APP_PASSWORD_HASH`.

## Scripts

| Command             | What it does                                  |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Dev server.                                  |
| `npm run build`     | Production build.                            |
| `npm run lint`      | ESLint.                                      |
| `npm run typecheck` | `tsc --noEmit`.                              |
| `npm test`          | Vitest (watch).                             |
| `npm run test:run`  | Vitest once (used by CI).                    |

CI (`.github/workflows/ci.yml`) runs lint + typecheck + tests + build on every
push to `main` and every PR.

## Deployment (Vercel)

1. Set every environment variable above in the Vercel project.
2. Point `DATABASE_URL` at the Supabase **transaction pooler**.
3. Generate `APP_PASSWORD_HASH` with `scripts/hash-password.mjs`, set it, and
   remove `APP_PASSWORD`.
4. Run `schema.sql` against the database once (it also enables RLS and revokes
   the default `anon`/`authenticated` grants).
