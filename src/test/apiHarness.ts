import { NextRequest } from "next/server";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/session";

// Test harness for route handlers. `vi.mock("@/lib/db", ...)` in a test file
// swaps in the fake `sql` below, which records every query (text with `?` for
// each interpolated value, plus the values) and answers from a handler. The
// real auth code still runs: requireUser checks a genuinely signed cookie, and
// the fake answers its `users` lookup like the database would.

export const USER_ID = "11111111-1111-4111-8111-111111111111";
export const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

export type RecordedQuery = { text: string; values: unknown[] };
type Handler = (query: RecordedQuery) => unknown[] | undefined;

export function createFakeSql() {
  const queries: RecordedQuery[] = [];
  let handler: Handler = () => undefined;
  // The users row requireUser reads; tests change `sessionVersion` to model a
  // revoked session or `active` to model a removed/pending account.
  const account = { active: true, sessionVersion: 0, isAdmin: false };

  const sql = ((strings: TemplateStringsArray | Record<string, unknown>, ...values: unknown[]) => {
    if (!Array.isArray(strings)) return { fragment: strings };
    const query = { text: strings.join("?").replace(/\s+/g, " ").trim(), values };
    // Auth lookups aren't interesting to assertions, so they aren't recorded.
    if (query.text.includes("is_admin, pushover_user_key is not null")) {
      const [id, version] = values;
      const ok = account.active && id === USER_ID && version === account.sessionVersion;
      return Promise.resolve(
        ok
          ? [
              {
                id: USER_ID,
                email: "me@example.com",
                is_admin: account.isAdmin,
                has_pushover: false,
                session_version: account.sessionVersion,
              },
            ]
          : []
      );
    }
    queries.push(query);
    return Promise.resolve(handler(query) ?? []);
  }) as unknown as ((...args: unknown[]) => Promise<unknown[]>) & { json: (v: unknown) => unknown };
  sql.json = (value: unknown) => ({ json: value });

  return {
    sql,
    queries,
    account,
    respond(next: Handler) {
      handler = next;
    },
    reset() {
      queries.length = 0;
      handler = () => undefined;
      account.active = true;
      account.sessionVersion = 0;
      account.isAdmin = false;
    },
  };
}

export type FakeSql = ReturnType<typeof createFakeSql>;

/** One shared fake per test file (each file gets its own module registry). */
export const fakeDb = createFakeSql();

/** Use as: vi.mock("@/lib/db", async () => (await import("@/test/apiHarness")).dbMock()) */
export function dbMock() {
  return { sql: fakeDb.sql, default: fakeDb.sql };
}

export async function authedRequest(
  url: string,
  init: { method?: string; body?: unknown; version?: number; cookie?: boolean } = {}
): Promise<NextRequest> {
  const headers: Record<string, string> = {};
  if (init.cookie !== false) {
    const value = await createSessionCookieValue(USER_ID, init.version ?? 0);
    headers.cookie = `${SESSION_COOKIE_NAME}=${value}`;
  }
  let body: string | undefined;
  if (init.body !== undefined) {
    headers["content-type"] = "application/json";
    body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
  }
  return new NextRequest(`http://localhost${url}`, { method: init.method ?? "GET", headers, body });
}

export const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) });
