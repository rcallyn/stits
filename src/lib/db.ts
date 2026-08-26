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

export const sql =
  globalForSql.sql ??
  postgres(process.env.DATABASE_URL as string, {
    max: 5,
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
