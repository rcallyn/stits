import { afterEach, describe, expect, it, vi } from "vitest";
import { applyBackup, buildLocalStorageBackup, isBackupData, type BackupData } from "@/lib/backup";
import { REPLACE_CONFIRMATION } from "@/lib/schemas";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubStorage(items: Record<string, string>) {
  vi.stubGlobal("window", {
    localStorage: { getItem: (key: string) => items[key] ?? null },
    location: { reload: vi.fn() },
  });
}

describe("isBackupData", () => {
  it("accepts objects with todos and scheduleEvents arrays", () => {
    expect(isBackupData({ todos: [], scheduleEvents: [] })).toBe(true);
  });

  it("rejects non-objects and missing or non-array fields", () => {
    expect(isBackupData(null)).toBe(false);
    expect(isBackupData("backup")).toBe(false);
    expect(isBackupData({ todos: [] })).toBe(false);
    expect(isBackupData({ todos: {}, scheduleEvents: [] })).toBe(false);
  });
});

describe("buildLocalStorageBackup", () => {
  it("reads each localStorage key", () => {
    stubStorage({
      "stits:todos": JSON.stringify([{ id: "t1" }]),
      "stits:category-order": JSON.stringify(["a", "b"]),
    });
    const backup = buildLocalStorageBackup();
    expect(backup.version).toBe(1);
    expect(backup.todos).toEqual([{ id: "t1" }]);
    expect(backup.categoryOrder).toEqual(["a", "b"]);
  });

  it("falls back to empty values for missing keys", () => {
    stubStorage({});
    const backup = buildLocalStorageBackup();
    expect(backup.todos).toEqual([]);
    expect(backup.scheduleEvents).toEqual([]);
    expect(backup.categoryColors).toEqual({});
    expect(backup.categoryLabels).toEqual({});
  });

  it("falls back when a value is not valid JSON", () => {
    stubStorage({ "stits:todos": "{not json" });
    expect(buildLocalStorageBackup().todos).toEqual([]);
  });
});

describe("applyBackup", () => {
  const data: BackupData = {
    version: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    todos: [],
    scheduleEvents: [],
    categoryColors: {},
    categoryLabels: {},
    categoryOrder: [],
  };

  it("posts a replace request with the confirmation string, then reloads", async () => {
    stubStorage({});
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await applyBackup(data);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/migrate");
    expect(JSON.parse(init.body)).toMatchObject({ replace: true, confirm: REPLACE_CONFIRMATION });
    expect(window.location.reload).toHaveBeenCalled();
  });

  it("throws the server's error message and does not reload", async () => {
    stubStorage({});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Nope" }) }),
    );
    await expect(applyBackup(data)).rejects.toThrow("Nope");
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("uses a generic message when the error body is not JSON", async () => {
    stubStorage({});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error("bad json");
        },
      }),
    );
    await expect(applyBackup(data)).rejects.toThrow("Import failed.");
  });
});
