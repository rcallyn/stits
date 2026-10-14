import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, verifyPasswordOrDummy } from "@/lib/password";

describe("verifyPassword", () => {
  it("verifies a password against its scrypt hash", () => {
    const hash = hashPassword("hunter2");
    expect(verifyPassword("hunter2", hash)).toBe(true);
    expect(verifyPassword("hunter3", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);
  });

  it("rejects a malformed hash string", () => {
    expect(verifyPassword("anything", "not-a-real-hash")).toBe(false);
  });

  it("produces a distinct salt per call", () => {
    expect(hashPassword("x")).not.toBe(hashPassword("x"));
  });
});

describe("verifyPasswordOrDummy", () => {
  it("never succeeds without a stored hash, even for the dummy password", () => {
    expect(verifyPasswordOrDummy("stits-dummy-password", undefined)).toBe(false);
    expect(verifyPasswordOrDummy("hunter2", hashPassword("hunter2"))).toBe(true);
  });
});
