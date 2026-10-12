import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
vi.mock("@/lib/db", () => ({
  sql: Object.assign((...args: unknown[]) => query(...args), {}),
}));

import {
  getSessionsValidAfter,
  resetSessionRevocationCache,
  revokeAllSessions,
} from "@/lib/sessionRevocation";

beforeEach(() => {
  query.mockReset();
  resetSessionRevocationCache();
});

describe("getSessionsValidAfter", () => {
  it("reads the cutoff and caches it briefly", async () => {
    query.mockResolvedValue([{ sessions_valid_after: new Date(5000) }]);
    expect(await getSessionsValidAfter(1000)).toBe(5000);
    expect(await getSessionsValidAfter(2000)).toBe(5000);
    expect(query).toHaveBeenCalledTimes(1);
    await getSessionsValidAfter(1000 + 16_000);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("treats a null cutoff as no revocations", async () => {
    query.mockResolvedValue([{ sessions_valid_after: null }]);
    expect(await getSessionsValidAfter(0)).toBe(0);
  });

  it("treats a missing column (migration not run yet) as no revocations", async () => {
    query.mockRejectedValue(Object.assign(new Error("no column"), { code: "42703" }));
    expect(await getSessionsValidAfter(0)).toBe(0);
  });

  it("falls back to a recent cached value on db errors, then fails closed", async () => {
    query.mockResolvedValueOnce([{ sessions_valid_after: new Date(7) }]);
    await getSessionsValidAfter(0);
    query.mockRejectedValue(new Error("db down"));
    expect(await getSessionsValidAfter(60_000)).toBe(7);
    await expect(getSessionsValidAfter(10 * 60_000)).rejects.toThrow("db down");
  });

  it("fails closed with no cache", async () => {
    query.mockRejectedValue(new Error("db down"));
    await expect(getSessionsValidAfter(0)).rejects.toThrow("db down");
  });
});

describe("revokeAllSessions", () => {
  it("writes the cutoff and updates the cache", async () => {
    query.mockResolvedValue([]);
    await revokeAllSessions(9000);
    expect(query).toHaveBeenCalledTimes(1);
    expect(await getSessionsValidAfter(9001)).toBe(9000);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
