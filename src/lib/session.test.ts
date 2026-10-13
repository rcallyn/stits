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

describe("session issued-at and revocation", () => {
  it("reads back the issued-at time", async () => {
    const { createSessionCookieValue, readSessionIssuedAt } = await load();
    const value = await createSessionCookieValue(1_700_000_000_000);
    expect(await readSessionIssuedAt(value)).toBe(1_700_000_000_000);
  });

  it("treats the pre-revocation 'authenticated' cookie as issued at 0", async () => {
    const { readSessionIssuedAt } = await load();
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("test-secret-value"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("authenticated"));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(await readSessionIssuedAt(`authenticated.${hex}`)).toBe(0);
  });

  it("rejects validly signed but malformed payloads and forged timestamps", async () => {
    const { createSessionCookieValue, readSessionIssuedAt } = await load();
    const value = await createSessionCookieValue(1000);
    expect(await readSessionIssuedAt(value.replace("v1.1000", "v1.9999"))).toBeNull();
    expect(await readSessionIssuedAt("v1.abc.deadbeef")).toBeNull();
  });

  it("revokes sessions issued before the cutoff only", async () => {
    const { isSessionRevoked } = await load();
    expect(isSessionRevoked(0, 0)).toBe(false);
    expect(isSessionRevoked(0, 5)).toBe(true);
    expect(isSessionRevoked(4, 5)).toBe(true);
    expect(isSessionRevoked(5, 5)).toBe(false);
    expect(isSessionRevoked(6, 5)).toBe(false);
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

describe("timingSafeEqual", () => {
  it("matches only identical strings", async () => {
    const { timingSafeEqual } = await load();
    expect(timingSafeEqual("123456", "123456")).toBe(true);
    expect(timingSafeEqual("123456", "123457")).toBe(false);
    expect(timingSafeEqual("123456", "12345")).toBe(false);
    expect(timingSafeEqual("123456", "1234567")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
    expect(timingSafeEqual("", "0")).toBe(false);
  });

  it("rejects a submitted code that is a prefix of the real one", async () => {
    const { createPendingCookieValue, verifyPendingCookieValue } = await load();
    const value = await createPendingCookieValue("123456");
    expect(await verifyPendingCookieValue(value, "1234")).toBe(false);
    expect(await verifyPendingCookieValue(value, "")).toBe(false);
  });
});
