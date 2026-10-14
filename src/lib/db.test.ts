import { afterEach, describe, expect, it, vi } from "vitest";

// A fake postgres.js: each created pool records its queries, and the first
// pool's queries hang forever, like a connection that died while its
// serverless instance was suspended.
const pools: { ended: boolean; queries: number; last?: unknown }[] = [];
vi.mock("postgres", () => ({
  default: () => {
    const state: (typeof pools)[number] = { ended: false, queries: 0 };
    const index = pools.push(state) - 1;
    const sql = (strings: TemplateStringsArray | Record<string, unknown>) => {
      if (!Array.isArray(strings)) return { fragment: strings };
      state.queries++;
      state.last = index === 0 ? new Promise(() => {}) : Promise.resolve([{ ok: true }]);
      return state.last;
    };
    sql.json = (value: unknown) => ({ json: value });
    sql.begin = (fn: (tx: unknown) => Promise<unknown>) => fn(sql);
    sql.end = async () => {
      state.ended = true;
    };
    return sql;
  },
}));

afterEach(() => {
  vi.useRealTimers();
});

describe("sql", () => {
  it("fails a hung query and replaces the pool so the next query works", async () => {
    vi.useFakeTimers();
    const { sql, DbTimeoutError } = await import("@/lib/db");

    const hung = sql`select 1`;
    const assertion = expect(hung).rejects.toBeInstanceOf(DbTimeoutError);
    await vi.advanceTimersByTimeAsync(8_000);
    await assertion;
    expect(pools[0].ended).toBe(true);

    await expect(sql`select 1`).resolves.toEqual([{ ok: true }]);
    expect(pools).toHaveLength(2);
    expect(pools[1].queries).toBe(1);
  });

  // postgres.js only treats a nested sql`...` as a fragment when it's the
  // Query object it created (`instanceof Query`); a wrapping Promise gets
  // sent as the string "[object Promise]" instead.
  it("returns postgres's own query object, so it still nests as a fragment", async () => {
    const { sql } = await import("@/lib/db");
    const query = sql`select 1`;
    expect(query).toBe(pools[pools.length - 1].last);
    await expect(query).resolves.toEqual([{ ok: true }]);
  });

  it("passes fragment helpers straight through", async () => {
    const { sql } = await import("@/lib/db");
    expect(sql.json({ a: 1 })).toEqual({ json: { a: 1 } });
    expect((sql as unknown as (v: object) => unknown)({ title: "x" })).toEqual({ fragment: { title: "x" } });
  });
});
