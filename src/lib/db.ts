import postgres from "postgres";

// postgres.js parses Postgres `date` columns (oid 1082) into JS `Date`
// objects by default, which then serialize as
// "2026-08-24T00:00:00.000Z" — not the plain "YYYY-MM-DD" strings every
// date field in this app (ScheduleEvent.date, Todo.dueDate, the recurrence
// expander's string comparisons, etc.) is built around. Registering `date`
// as a passthrough type keeps it a plain string end to end.
const DATE_OID = 1082;

type Sql = ReturnType<typeof postgres>;

// Reused across Next.js dev-server hot reloads so we don't open a fresh
// connection pool on every module re-evaluation.
const globalForSql = globalThis as unknown as { sqlPool?: Sql };

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}
const DATABASE_URL = process.env.DATABASE_URL;

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
function createPool(): Sql {
  return postgres(DATABASE_URL, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 5,
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
}

let pool: Sql = globalForSql.sqlPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForSql.sqlPool = pool;

// Vercel suspends idle function instances, and a pooled connection can die
// while its instance is frozen without the socket ever being told. The next
// query written to it then waits forever: the request hangs instead of
// failing, so the page sits on a loading skeleton and a write (e.g. ticking
// a todo) silently never lands. Every query and transaction therefore gets
// a deadline; past it, the pool is thrown away and replaced so the next
// request gets a fresh connection, and this one fails fast with an error the
// client retries or reports.
const QUERY_TIMEOUT_MS = 8_000;
const TRANSACTION_TIMEOUT_MS = 20_000;

export class DbTimeoutError extends Error {}

function resetPool(stale: Sql) {
  if (pool !== stale) return; // already replaced by a concurrent timeout
  pool = createPool();
  if (process.env.NODE_ENV !== "production") globalForSql.sqlPool = pool;
  stale.end({ timeout: 0 }).catch(() => {});
}

function withDeadline<T>(work: PromiseLike<T>, ms: number, owner: Sql): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      resetPool(owner);
      reject(new DbTimeoutError(`Database didn't respond within ${ms}ms`));
    }, ms);
  });
  return Promise.race([Promise.resolve(work), deadline]).finally(() => clearTimeout(timer));
}

function isTemplateCall(args: unknown[]): boolean {
  return Array.isArray(args[0]) && "raw" in (args[0] as object);
}

// `sql` forwards to whichever pool is current, so a reset is invisible to
// callers. Tagged-template calls are queries and get the deadline; other
// calls (`sql(fields)`, `sql.json(...)`) build query fragments and pass
// straight through. Query results are only ever awaited in this codebase,
// so returning a plain promise for them is safe.
export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    const current = pool;
    const result = Reflect.apply(current as unknown as (...a: unknown[]) => unknown, current, args);
    if (!isTemplateCall(args)) return result;
    // Keep the original Query object (so it still works as a nested
    // fragment inside another sql`...`) and only add the deadline when
    // it's actually awaited.
    const query = result as PromiseLike<unknown> & { then: PromiseLike<unknown>["then"] };
    const originalThen = query.then.bind(query);
    query.then = ((onFulfilled, onRejected) =>
      withDeadline({ then: originalThen }, QUERY_TIMEOUT_MS, current).then(onFulfilled, onRejected)) as typeof query.then;
    return query;
  },
  get(_target, prop) {
    const current = pool;
    if (prop === "begin") {
      return (...args: unknown[]) =>
        withDeadline(
          (current.begin as (...a: unknown[]) => PromiseLike<unknown>)(...args),
          TRANSACTION_TIMEOUT_MS,
          current
        );
    }
    const value = Reflect.get(current, prop);
    return typeof value === "function" ? value.bind(current) : value;
  },
});
