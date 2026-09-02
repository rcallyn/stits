import postgres from "postgres";

// postgres.js parses Postgres `date` columns (oid 1082) into JS `Date`
// objects by default, which then serialize as
// "2026-08-24T00:00:00.000Z" — not the plain "YYYY-MM-DD" strings every
// date field in this app (ScheduleEvent.date, Todo.dueDate, the recurrence
// expander's string comparisons, etc.) is built around. Registering `date`
// as a passthrough type keeps it a plain string end to end.
const DATE_OID = 1082;

// Reused across Next.js dev-server hot reloads so we don't open a fresh
// connection pool on every module re-evaluation.
const globalForSql = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// This runs on Vercel's serverless functions: many short-lived instances,
// each briefly needing one or two connections. Point DATABASE_URL at the
// Supabase transaction pooler (host *.pooler.supabase.com, port 6543) so
// those connections are multiplexed onto a small pool of real backends
// instead of exhausting Postgres's connection limit under load.
//
// - max: 1 — one connection per instance; the pooler does the fan-in.
// - prepare: false — pgbouncer in transaction mode can't carry server-side
//   prepared statements across pooled connections. Harmless on a direct
//   connection too (these queries are tiny), so it's unconditional.
// - idle_timeout / connect_timeout — release idle sockets quickly and fail
//   fast rather than hang a request when the DB is unreachable.
export const sql =
  globalForSql.sql ??
  postgres(process.env.DATABASE_URL, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    types: {
      date: {
        to: DATE_OID,
        from: [DATE_OID],
        serialize: (value: string) => value,
        parse: (raw: string) => raw,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForSql.sql = sql;
}
