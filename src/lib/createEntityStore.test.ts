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
      if (!init?.method) return new Response(JSON.stringify({ rows: server }), { status: 200 });
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
      if (!init?.method) return new Response(JSON.stringify({ rows: server }), { status: 200 });
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

describe("createEntityStore refetch ordering", () => {
  it("ignores a refetch that resolves after a newer one", async () => {
    const releases: Array<() => void> = [];
    let call = 0;
    const fetchMock = vi.fn(async () => {
      const v = ++call;
      await new Promise<void>((r) => releases.push(r));
      return new Response(JSON.stringify({ rows: [{ id: "a", v }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const store = makeStore(fetchMock);
    const first = store.refresh();
    const second = store.refresh();
    releases[1](); // newer response lands first
    await second;
    releases[0](); // stale response lands last
    await first;
    expect(store.getAll()).toEqual([{ id: "a", v: 2 }]);
  });

  it("doesn't apply a refetch while a write is still in flight", async () => {
    const server: Row[] = [{ id: "a", v: 1 }];
    let releaseWrite: () => void = () => {};
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        await new Promise<void>((r) => (releaseWrite = r));
        server[0] = { id: "a", v: 2 };
        return new Response("{}", { status: 200 });
      }
      return new Response(JSON.stringify({ rows: server }), { status: 200 });
    }) as unknown as typeof fetch;

    const store = makeStore(fetchMock);
    store.mutate(
      (cur) => [...cur.filter((r) => r.id !== "a"), { id: "a", v: 2 }],
      () => fetch("/api/rows/a", { method: "PATCH" })
    );
    await store.refresh(); // e.g. another write's follow-up refetch, pre-PATCH data
    expect(store.getAll()).toEqual([{ id: "a", v: 2 }]); // optimistic value kept

    releaseWrite();
    await flush();
    await flush();
    expect(store.getAll()).toEqual([{ id: "a", v: 2 }]);
  });
});

describe("createEntityStore.ensureHydrated", () => {
  it("retries a failed first load instead of settling on an empty list", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { addEventListener: () => {} });
    vi.stubGlobal("document", { addEventListener: () => {}, visibilityState: "visible" });
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call++;
      if (call === 1) return new Response("", { status: 500 });
      return new Response(JSON.stringify({ rows: [{ id: "a", v: 1 }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const store = makeStore(fetchMock);
    store.ensureHydrated();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getHydratedSnapshot()).toBe(false); // still loading, not "empty"
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getHydratedSnapshot()).toBe(true);
    expect(store.getAll()).toEqual([{ id: "a", v: 1 }]);
    vi.useRealTimers();
  });
});

describe("createEntityStore offline copy", () => {
  function memoryStorage(): Storage {
    const m = new Map<string, string>();
    return {
      get length() {
        return m.size;
      },
      key: (i: number) => [...m.keys()][i] ?? null,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
    };
  }

  function offlineStore(fetchImpl: typeof fetch) {
    vi.stubGlobal("fetch", fetchImpl);
    vi.stubGlobal("window", { addEventListener: () => {}, setTimeout });
    vi.stubGlobal("document", { addEventListener: () => {}, visibilityState: "visible" });
    return createEntityStore<Row>({
      endpoint: "/api/rows",
      fromResponse: (data) => (data as { rows: Row[] }).rows,
      noun: "row",
      offlineKey: "rows",
    });
  }

  it("saves on success and falls back to it when every load attempt fails", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("localStorage", memoryStorage());
    let online = true;
    const fetchMock = vi.fn(async () => {
      if (!online) throw new TypeError("offline");
      return new Response(JSON.stringify({ rows: [{ id: "a", v: 1 }] }), { status: 200 });
    }) as unknown as typeof fetch;

    await offlineStore(fetchMock).refresh(); // an earlier visit

    online = false;
    const fresh = offlineStore(fetchMock); // new page load, no network
    const before = getToasts().length;
    fresh.ensureHydrated();
    await vi.advanceTimersByTimeAsync(13_000);
    expect(fresh.getHydratedSnapshot()).toBe(true);
    expect(fresh.getAll()).toEqual([{ id: "a", v: 1 }]);
    expect(getToasts().slice(before)[0].message).toMatch(/offline — showing your rows/i);
    vi.useRealTimers();
  });

  it("drops the saved copy when the session is rejected", async () => {
    vi.stubGlobal("localStorage", memoryStorage());
    localStorage.setItem("stits:offline:rows", JSON.stringify({ v: 1, savedAt: 1, items: [{ id: "x", v: 1 }] }));
    const store = offlineStore((async () => new Response("", { status: 401 })) as unknown as typeof fetch);
    await store.refresh();
    expect(localStorage.getItem("stits:offline:rows")).toBeNull();
  });
});
