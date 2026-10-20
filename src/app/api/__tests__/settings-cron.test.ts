import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { authedRequest, fakeDb, USER_ID } from "@/test/apiHarness";

vi.mock("@/lib/db", async () => (await import("@/test/apiHarness")).dbMock());
vi.mock("@/lib/pushover", () => ({
  sendPushoverNotification: vi.fn(async () => true),
  isValidPushoverUserKey: vi.fn(async () => true),
}));
vi.mock("@/lib/canvasSync", () => ({ runCanvasSync: vi.fn(async () => undefined) }));
vi.mock("@/lib/digest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/digest")>()),
  loadDayPlan: vi.fn(async () => ({ events: [], dueTodos: [], tomorrow: [] })),
}));

import { GET as getSettings, PATCH as patchSettings } from "@/app/api/settings/route";
import { GET as dailyDigest } from "@/app/api/cron/daily-digest/route";
import { sendPushoverNotification } from "@/lib/pushover";
import { runCanvasSync } from "@/lib/canvasSync";

const pushMock = vi.mocked(sendPushoverNotification);

beforeEach(() => {
  fakeDb.reset();
  pushMock.mockClear();
  vi.mocked(runCanvasSync).mockClear();
});

describe("/api/settings", () => {
  const row = {
    category_colors: { school: "#fff" },
    category_labels: null,
    category_order: ["school"],
    canvas_feed_url: null,
    canvas_last_synced_at: null,
  };

  it("requires a session", async () => {
    expect((await getSettings(await authedRequest("/api/settings", { cookie: false }))).status).toBe(401);
    expect(
      (await patchSettings(await authedRequest("/api/settings", { method: "PATCH", body: {}, cookie: false }))).status
    ).toBe(401);
  });

  it("maps a row to the client shape, filling gaps with defaults", async () => {
    fakeDb.respond(() => [row]);
    const res = await getSettings(await authedRequest("/api/settings"));
    expect(await res.json()).toEqual({
      categoryColors: { school: "#fff" },
      categoryLabels: {},
      categoryOrder: ["school"],
      canvasFeedUrl: "",
    });
    expect(fakeDb.queries[0].values).toEqual([USER_ID]);
  });

  it("rejects an empty patch and unknown keys", async () => {
    for (const body of [{}, { isAdmin: true }]) {
      const res = await patchSettings(await authedRequest("/api/settings", { method: "PATCH", body }));
      expect(res.status).toBe(400);
    }
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("upserts only the submitted fields for the signed-in user", async () => {
    fakeDb.respond(() => [row]);
    const res = await patchSettings(
      await authedRequest("/api/settings", { method: "PATCH", body: { categoryOrder: ["school"] } })
    );
    expect(res.status).toBe(200);
    const [q] = fakeDb.queries;
    expect(q.text).toContain("on conflict (user_id) do update");
    const [insertFragment, updateFragment] = q.values as { fragment: Record<string, unknown> }[];
    expect(insertFragment.fragment).toMatchObject({ user_id: USER_ID });
    expect(Object.keys(updateFragment.fragment)).toEqual(["category_order"]);
  });
});

describe("GET /api/cron/daily-digest", () => {
  const req = (auth?: string) =>
    new NextRequest("http://localhost/api/cron/daily-digest", { headers: auth ? { authorization: auth } : {} });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("is closed without the cron secret, including when none is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await dailyDigest(req("Bearer "))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await dailyDigest(req())).status).toBe(401);
    expect((await dailyDigest(req("Bearer wrong"))).status).toBe(401);
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("does nothing when it isn't 7am Eastern (the off-DST-half of the double schedule)", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.useFakeTimers({ now: new Date("2026-07-15T12:00:00Z"), toFake: ["Date"] }); // 8am EDT
    const res = await dailyDigest(req("Bearer s3cret"));
    expect((await res.json()).skipped).toBe(true);
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("at 7am Eastern (EDT and EST) syncs Canvas feeds and pushes to users who have a key", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    for (const now of ["2026-07-15T11:00:00Z", "2026-12-15T12:00:00Z"]) {
      vi.useFakeTimers({ now: new Date(now), toFake: ["Date"] });
      pushMock.mockClear();
      fakeDb.respond(() => [
        { id: "u1", pushover_user_key: "k".repeat(30), canvas_feed_url: "https://canvas.example/feed.ics" },
        { id: "u2", pushover_user_key: null, canvas_feed_url: null },
      ]);
      const res = await dailyDigest(req("Bearer s3cret"));
      expect(await res.json()).toMatchObject({ users: 2, sent: 1, failed: 0 });
      expect(pushMock).toHaveBeenCalledTimes(1);
    }
    expect(runCanvasSync).toHaveBeenCalledWith("u1");
    expect(runCanvasSync).not.toHaveBeenCalledWith("u2");
  });

  it("counts a failed push and keeps going", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.useFakeTimers({ now: new Date("2026-07-15T11:00:00Z"), toFake: ["Date"] });
    pushMock.mockResolvedValueOnce(false);
    fakeDb.respond(() => [
      { id: "u1", pushover_user_key: "a".repeat(30), canvas_feed_url: null },
      { id: "u2", pushover_user_key: "b".repeat(30), canvas_feed_url: null },
    ]);
    const res = await dailyDigest(req("Bearer s3cret"));
    expect(await res.json()).toMatchObject({ sent: 1, failed: 1 });
  });
});
