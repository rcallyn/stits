import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllOfflineCopies,
  clearOfflineCopy,
  describeAge,
  loadOfflineCopy,
  saveOfflineCopy,
} from "@/lib/offlineCache";

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

beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("offline copies", () => {
  it("round-trips a list with its save time", () => {
    saveOfflineCopy("todos", [{ id: "a" }]);
    const got = loadOfflineCopy<{ id: string }>("todos");
    expect(got?.items).toEqual([{ id: "a" }]);
    expect(got?.savedAt).toBeLessThanOrEqual(Date.now());
  });

  it("returns null for missing, corrupt, or wrong-version data", () => {
    expect(loadOfflineCopy("nope")).toBeNull();
    localStorage.setItem("stits:offline:bad", "{not json");
    expect(loadOfflineCopy("bad")).toBeNull();
    localStorage.setItem("stits:offline:old", JSON.stringify({ v: 0, savedAt: 1, items: [] }));
    expect(loadOfflineCopy("old")).toBeNull();
  });

  it("clears one key or all of ours, leaving other storage alone", () => {
    saveOfflineCopy("todos", [1]);
    saveOfflineCopy("events", [2]);
    localStorage.setItem("theme", "dark");
    clearOfflineCopy("todos");
    expect(loadOfflineCopy("todos")).toBeNull();
    expect(loadOfflineCopy("events")).not.toBeNull();
    clearAllOfflineCopies();
    expect(loadOfflineCopy("events")).toBeNull();
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("never throws when storage is unavailable or full", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("quota");
      },
    });
    expect(() => saveOfflineCopy("todos", [1])).not.toThrow();
    expect(loadOfflineCopy("todos")).toBeNull();
    expect(() => clearAllOfflineCopies()).not.toThrow();
  });
});

describe("describeAge", () => {
  const now = 1_000_000_000_000;
  it("formats minutes, hours and days", () => {
    expect(describeAge(now - 10_000, now)).toBe("just now");
    expect(describeAge(now - 60_000, now)).toBe("1 minute ago");
    expect(describeAge(now - 5 * 60_000, now)).toBe("5 minutes ago");
    expect(describeAge(now - 3 * 3_600_000, now)).toBe("3 hours ago");
    expect(describeAge(now - 72 * 3_600_000, now)).toBe("3 days ago");
  });
});
