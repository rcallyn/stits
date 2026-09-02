import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.SESSION_SECRET = "test-secret-value";
});

afterEach(() => {
  vi.useRealTimers();
});

async function load() {
  return import("@/lib/session");
}

describe("session cookie", () => {
  it("round-trips a valid signed session cookie", async () => {
    const { createSessionCookieValue, isValidSessionCookie } = await load();
    const value = await createSessionCookieValue();
    expect(await isValidSessionCookie(value)).toBe(true);
  });

  it("rejects a missing, tampered, or wrong-payload cookie", async () => {
    const { createSessionCookieValue, isValidSessionCookie } = await load();
    const value = await createSessionCookieValue();
    expect(await isValidSessionCookie(undefined)).toBe(false);
    expect(await isValidSessionCookie(value.slice(0, -2) + "00")).toBe(false);
    expect(await isValidSessionCookie("authenticated.deadbeef")).toBe(false);
  });

  it("rejects a cookie signed with a different secret", async () => {
    const { createSessionCookieValue } = await load();
    const value = await createSessionCookieValue();

    vi.resetModules();
    process.env.SESSION_SECRET = "a-completely-different-secret";
    const { isValidSessionCookie } = await load();
    expect(await isValidSessionCookie(value)).toBe(false);
  });
});

describe("pending 2FA cookie", () => {
  it("accepts the matching code before it expires", async () => {
    const { createPendingCookieValue, verifyPendingCookieValue } = await load();
    const value = await createPendingCookieValue("123456");
    expect(await verifyPendingCookieValue(value, "123456")).toBe(true);
    expect(await verifyPendingCookieValue(value, "000000")).toBe(false);
  });

  it("rejects the code once the TTL has passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00Z"));
    const { createPendingCookieValue, verifyPendingCookieValue } = await load();
    const value = await createPendingCookieValue("123456");

    vi.setSystemTime(new Date("2026-09-02T00:06:00Z")); // 6 min later, TTL is 5
    expect(await verifyPendingCookieValue(value, "123456")).toBe(false);
  });
});
