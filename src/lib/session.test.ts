import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

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
  it("round-trips the user id and session version through a signed cookie", async () => {
    const { createSessionCookieValue, getSessionClaims, isValidSessionCookie } = await load();
    const value = await createSessionCookieValue(USER, 3);
    expect(await getSessionClaims(value)).toEqual({ userId: USER, version: 3 });
    expect(await isValidSessionCookie(value)).toBe(true);
  });

  it("rejects a missing, tampered, or wrong-payload cookie", async () => {
    const { createSessionCookieValue, getSessionClaims } = await load();
    const value = await createSessionCookieValue(USER, 1);
    expect(await getSessionClaims(undefined)).toBeNull();
    expect(await getSessionClaims(value.slice(0, -2) + "00")).toBeNull();
    expect(await getSessionClaims("authenticated.deadbeef")).toBeNull();
  });

  it("rejects a signed cookie from the single-user version", async () => {
    const { getSessionClaims } = await load();
    const secret = new TextEncoder().encode("test-secret-value");
    const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("authenticated"));
    const hex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
    expect(await getSessionClaims(`authenticated.${hex}`)).toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    const { createSessionCookieValue } = await load();
    const value = await createSessionCookieValue(USER, 1);

    vi.resetModules();
    process.env.SESSION_SECRET = "a-completely-different-secret";
    const { getSessionClaims } = await load();
    expect(await getSessionClaims(value)).toBeNull();
  });
});

describe("session secret and payload checks", () => {
  it("throws when SESSION_SECRET is not set", async () => {
    delete process.env.SESSION_SECRET;
    const { createSessionCookieValue } = await load();
    await expect(createSessionCookieValue(USER, 1)).rejects.toThrow("SESSION_SECRET");
  });

  it("rejects a validly signed payload that isn't user:<uuid>:<version>", async () => {
    const { getSessionClaims } = await load();
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("test-secret-value"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signed = async (payload: string) => {
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
      return `${payload}.${Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("")}`;
    };
    expect(await getSessionClaims(await signed(`user:${USER}:7`))).toEqual({ userId: USER, version: 7 });
    expect(await getSessionClaims(await signed("user:not-a-uuid:1"))).toBeNull();
    expect(await getSessionClaims(await signed(`user:${USER}:`))).toBeNull();
    expect(await getSessionClaims(await signed(`user:${USER}:1234567890`))).toBeNull();
  });
});

describe("pending 2FA cookie", () => {
  it("rejects a missing or malformed cookie", async () => {
    const { verifyPendingCookieValue } = await load();
    expect(await verifyPendingCookieValue(undefined, "123456")).toBeNull();
    expect(await verifyPendingCookieValue("garbage", "123456")).toBeNull();
    expect(await verifyPendingCookieValue("a.zz", "123456")).toBeNull();
  });

  it("returns the user id for the matching code before it expires", async () => {
    const { createPendingCookieValue, verifyPendingCookieValue } = await load();
    const value = await createPendingCookieValue(USER, "123456");
    expect(await verifyPendingCookieValue(value, "123456")).toBe(USER);
    expect(await verifyPendingCookieValue(value, "000000")).toBeNull();
  });

  it("doesn't reveal the code to the client holding the cookie", async () => {
    const { createPendingCookieValue } = await load();
    const value = await createPendingCookieValue(USER, "123456");
    expect(value).not.toContain("123456");
  });

  it("rejects the code once the TTL has passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00Z"));
    const { createPendingCookieValue, verifyPendingCookieValue } = await load();
    const value = await createPendingCookieValue(USER, "123456");

    vi.setSystemTime(new Date("2026-09-02T00:06:00Z")); // 6 min later, TTL is 5
    expect(await verifyPendingCookieValue(value, "123456")).toBeNull();
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
    const value = await createPendingCookieValue(USER, "123456");
    expect(await verifyPendingCookieValue(value, "1234")).toBeNull();
    expect(await verifyPendingCookieValue(value, "")).toBeNull();
  });
});
