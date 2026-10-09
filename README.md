# stits

This is my personal productivity app: a calendar and a todo list on one
dashboard, built so adding something to my day takes a few seconds and
glancing at it tells me everything I need to know.

I designed and directed the project; every line of code was written
by Claude, Anthropic's AI coding assistant.

![Dashboard — week view with todos, sample data](docs/dashboard-demo.png)
<sub>Sample data shown above — not my real todos or schedule.</sub>

## What it does

- **Calendar and todos live side by side**, so I'm not jumping between pages
  to see what's happening today versus what I still need to do.
- **Drag a todo straight onto the calendar to schedule it** — works with a
  mouse or a finger. Drop it on a day and it just sits there with no time
  attached; drop it on a time slot and it becomes a 15-minute event right
  then.
- **Quick-add**, I can type something like "dentist
  appointment tomorrow at 3pm" and it figures out the date and time itself —
  no date picker needed.
- **Todos can carry notes, subtasks, a priority, and a color-coded category**,
  plus due dates and a nudge when something's overdue.
- **Pulls assignments straight from Canvas** once I give it my calendar feed
  link, so I don't have to enter school deadlines by hand.
- **Texts me every morning at 7am** with the day's schedule, what's due, and
  a quote to start the day.
- **Installs like a real app** on my phone or laptop, and still works (mostly)
  with no connection.
- **No accounts, just one password** plus a push-notification code to log in
  — it only ever needed to work for one person: me.

## Running it locally

```bash
npm install
cp .env.example .env.local          # then fill in the values below
# create the schema once against your database:
psql "$DATABASE_URL" -f schema.sql
npm run dev
```

### Environment variables

| Variable             | Required | What it's for                                      |
| --------------------- | -------- | --------------------------------------------------- |
| `DATABASE_URL`        | yes      | Your Postgres connection string.                     |
| `SESSION_SECRET`      | yes      | Any random string; keeps login sessions secure.      |
| `APP_PASSWORD`        | \*       | The login password.                                  |
| `APP_PASSWORD_HASH`   | \*       | A hashed version of the password — use this instead of `APP_PASSWORD` in production. Generate one with `node scripts/hash-password.mjs '<password>'`. |
| `ANTHROPIC_API_KEY`   | yes      | Powers the natural-language quick-add.               |
| `PUSHOVER_APP_TOKEN`  | yes      | Sends the login code and the daily digest.           |
| `PUSHOVER_USER_KEY`   | yes      | Recipient of the login code and the daily digest.    |
| `CRON_SECRET`         | no       | Only needed if you want the daily digest to run.     |

\* Set at least one of `APP_PASSWORD` / `APP_PASSWORD_HASH`.

### Useful commands

| Command         | What it does      |
| ---------------- | ------------------ |
| `npm run dev`     | Starts the app locally. |
| `npm run build`   | Builds it for production. |
| `npm test`        | Runs the test suite. |
