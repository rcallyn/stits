import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashPassword, verifyAppPassword } from "@/lib/password";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.APP_PASSWORD;
  delete process.env.APP_PASSWORD_HASH;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("verifyAppPassword", () => {
  it("verifies against a scrypt hash when APP_PASSWORD_HASH is set", () => {
    process.env.APP_PASSWORD_HASH = hashPassword("hunter2");
    expect(verifyAppPassword("hunter2")).toBe(true);
    expect(verifyAppPassword("hunter3")).toBe(false);
    expect(verifyAppPassword("")).toBe(false);
  });

  it("falls back to plaintext APP_PASSWORD when no hash is configured", () => {
    process.env.APP_PASSWORD = "plainpass";
    expect(verifyAppPassword("plainpass")).toBe(true);
    expect(verifyAppPassword("wrong")).toBe(false);
  });

  it("prefers the hash over the plaintext when both are set", () => {
    process.env.APP_PASSWORD = "plainpass";
    process.env.APP_PASSWORD_HASH = hashPassword("thehash");
    expect(verifyAppPassword("plainpass")).toBe(false);
    expect(verifyAppPassword("thehash")).toBe(true);
  });

  it("rejects a malformed hash string", () => {
    process.env.APP_PASSWORD_HASH = "not-a-real-hash";
    expect(verifyAppPassword("anything")).toBe(false);
  });

  it("produces a distinct salt per call", () => {
    expect(hashPassword("x")).not.toBe(hashPassword("x"));
  });
});
