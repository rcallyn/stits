import { afterEach, describe, expect, it, vi } from "vitest";
import { createEntityStore } from "@/lib/createEntityStore";
import { getToasts } from "@/lib/toast";

type Row = { id: string; v: number };

function makeStore(fetchImpl: typeof fetch) {
  vi.stubGlobal("fetch", fetchImpl);
  return createEntityStore<Row>({
    endpoint: "/api/rows",
    fromResponse: (data) => (data as { rows: Row[] }).rows,
    noun: "row",
  });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createEntityStore.mutate", () => {
  it("applies the optimistic change, then reconciles with a refetch on success", async () => {
    const server: Row[] = [{ id: "a", v: 1 }];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (!init) return new Response(JSON.stringify({ rows: server }), { status: 200 });
      // the write: bump the server copy
      server[0] = { id: "a", v: 2 };
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    const store = makeStore(fetchMock);
    await store.refresh();
    expect(store.getAll()).toEqual([{ id: "a", v: 1 }]);

    store.mutate(
      (cur) => cur.map((r) => ({ ...r, v: 99 })),
      () => fetch("/api/rows/a", { method: "PATCH" }),
      { action: "update" }
    );
    expect(store.getAll()).toEqual([{ id: "a", v: 99 }]); // optimistic
    await flush();
    expect(store.getAll()).toEqual([{ id: "a", v: 2 }]); // reconciled to server truth
  });

  it("rolls back via refetch and pushes a toast when the write fails", async () => {
    const server: Row[] = [{ id: "a", v: 1 }];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (!init) return new Response(JSON.stringify({ rows: server }), { status: 200 });
      return new Response(JSON.stringify({ error: "nope" }), { status: 400 });
    }) as unknown as typeof fetch;

    const store = makeStore(fetchMock);
    await store.refresh();

    const toastsBefore = getToasts().length;
    store.mutate(
      (cur) => cur.map((r) => ({ ...r, v: 99 })),
      () => fetch("/api/rows/a", { method: "PATCH" }),
      { action: "update" }
    );
    expect(store.getAll()).toEqual([{ id: "a", v: 99 }]);
    await flush();

    expect(store.getAll()).toEqual([{ id: "a", v: 1 }]); // rolled back
    const added = getToasts().slice(toastsBefore);
    expect(added).toHaveLength(1);
    expect(added[0].message).toMatch(/couldn't update that row/i);
  });
});
