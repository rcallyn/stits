import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

import { clientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";

function req(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe("clientIp", () => {
  it("prefers the platform-set x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4" }))).toBe(
      "203.0.113.7"
    );
  });

  it("falls back to the last (trusted) x-forwarded-for hop, not the spoofable first", () => {
    expect(clientIp(req({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("returns a constant when no IP header is present", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("isRateLimited", () => {
  const now = new Date("2026-09-02T12:00:00Z");

  beforeEach(() => {
    sqlMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  const row = (attempts: number, minutesAgo: number) => [
    { attempts, window_start: new Date(now.getTime() - minutesAgo * 60_000).toISOString() },
  ];

  it("is not limited when there is no record", async () => {
    sqlMock.mockResolvedValue([]);
    expect(await isRateLimited("login", "1.2.3.4")).toEqual({ limited: false });
  });

  it("is not limited below the attempt cap", async () => {
    sqlMock.mockResolvedValue(row(7, 1));
    expect(await isRateLimited("login", "1.2.3.4")).toEqual({ limited: false });
  });

  it("is limited at the cap and reports the seconds left in the window", async () => {
    sqlMock.mockResolvedValue(row(8, 5));
    expect(await isRateLimited("login", "1.2.3.4")).toEqual({
      limited: true,
      retryAfterSeconds: 10 * 60,
    });
  });

  it("is not limited once the window has expired", async () => {
    sqlMock.mockResolvedValue(row(50, 16));
    expect(await isRateLimited("login", "1.2.3.4")).toEqual({ limited: false });
  });

  it("uses the per-scope cap", async () => {
    sqlMock.mockResolvedValue(row(5, 1));
    expect((await isRateLimited("signup", "1.2.3.4")).limited).toBe(true);
    expect((await isRateLimited("login-account", "a@b.co")).limited).toBe(false);
  });
});

describe("recordAttempt", () => {
  const now = new Date("2026-09-02T12:00:00Z");

  beforeEach(() => {
    sqlMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  // The first call is the select; the second is the write whose SQL we inspect.
  const writeSql = () => (sqlMock.mock.calls[1][0] as string[]).join("?");

  it("inserts a fresh counter when there is no record", async () => {
    sqlMock.mockResolvedValue([]);
    await recordAttempt("login", "1.2.3.4");
    expect(sqlMock).toHaveBeenCalledTimes(2);
    expect(writeSql()).toContain("insert into login_attempts");
  });

  it("increments the counter inside an active window", async () => {
    sqlMock.mockResolvedValueOnce([{ window_start: new Date(now.getTime() - 60_000).toISOString() }]);
    await recordAttempt("login", "1.2.3.4");
    expect(writeSql()).toContain("attempts = attempts + 1");
  });

  it("restarts the counter once the window has expired", async () => {
    sqlMock.mockResolvedValueOnce([
      { window_start: new Date(now.getTime() - 16 * 60_000).toISOString() },
    ]);
    await recordAttempt("login", "1.2.3.4");
    expect(writeSql()).toContain("on conflict (scope, ip) do update");
  });
});
