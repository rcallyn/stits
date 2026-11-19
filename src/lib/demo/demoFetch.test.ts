import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://stits.test";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

// demoFetch keeps an "installed" flag at module level, so each test loads a
// fresh copy and gets fresh stubbed browser globals.
async function setup(opts: { cookie?: string; storage?: ReturnType<typeof memoryStorage> } = {}) {
  vi.resetModules();
  const realFetch = vi.fn<typeof fetch>(async () => new Response("real"));
  const storage = opts.storage ?? memoryStorage();
  const win = {
    fetch: realFetch,
    location: { origin: ORIGIN, href: `${ORIGIN}/demo` },
  };
  const doc = { cookie: opts.cookie ?? "" };
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  vi.stubGlobal("sessionStorage", storage);
  const mod = await import("@/lib/demo/demoFetch");
  return { mod, win, doc, storage, realFetch };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("isDemoCookieSet", () => {
  it("matches only the exact demo cookie", async () => {
    const { mod, doc } = await setup({ cookie: "a=1; stits_demo=1; b=2" });
    expect(mod.isDemoCookieSet()).toBe(true);
    doc.cookie = "a=1; stits_demo=0";
    expect(mod.isDemoCookieSet()).toBe(false);
    doc.cookie = "xstits_demo=1";
    expect(mod.isDemoCookieSet()).toBe(false);
    doc.cookie = "";
    expect(mod.isDemoCookieSet()).toBe(false);
  });
});

describe("installDemoFetch", () => {
  it("answers same-origin /api calls from the sample data and passes other requests through", async () => {
    const { mod, win, realFetch } = await setup();
    mod.installDemoFetch();

    const res = await win.fetch(`${ORIGIN}/api/todos`);
    expect(res.status).toBe(200);
    expect(Array.isArray((await res.json()).todos)).toBe(true);
    expect(realFetch).not.toHaveBeenCalled();

    await win.fetch("https://example.com/api/todos");
    await win.fetch(`${ORIGIN}/not-api`);
    expect(realFetch).toHaveBeenCalledTimes(2);
  });

  it("persists changes to sessionStorage but only after non-GET requests", async () => {
    const { mod, win, storage } = await setup();
    mod.installDemoFetch();
    const before = storage.data.get("stits:demo-data");
    expect(before).toBeTruthy();

    await win.fetch(`${ORIGIN}/api/todos`, {
      method: "POST",
      body: JSON.stringify({ title: "Buy milk" }),
    });
    const after = storage.data.get("stits:demo-data")!;
    expect(after).not.toBe(before);
    expect(after).toContain("Buy milk");
  });

  it("treats an unparsable body as no body instead of throwing", async () => {
    const { mod, win } = await setup();
    mod.installDemoFetch();
    const res = await win.fetch(`${ORIGIN}/api/todos`, { method: "POST", body: "{not json" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("starts from fresh sample data when the saved state is corrupt", async () => {
    const storage = memoryStorage({ "stits:demo-data": "{broken" });
    const { mod, win } = await setup({ storage });
    mod.installDemoFetch();
    const res = await win.fetch(`${ORIGIN}/api/todos`);
    expect(res.status).toBe(200);
    expect(JSON.parse(storage.data.get("stits:demo-data")!)).toHaveProperty("todos");
  });

  it("only patches fetch once", async () => {
    const { mod, win } = await setup();
    mod.installDemoFetch();
    const patched = win.fetch;
    mod.installDemoFetch();
    expect(win.fetch).toBe(patched);
  });

  it("clears the demo cookie and saved data on logout", async () => {
    const { mod, win, doc, storage } = await setup({ cookie: "stits_demo=1" });
    mod.installDemoFetch();
    await win.fetch(`${ORIGIN}/api/logout`, { method: "POST" });
    expect(doc.cookie).toBe("stits_demo=; path=/; max-age=0");
    expect(storage.data.has("stits:demo-data")).toBe(false);
  });
});
