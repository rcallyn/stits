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

  it("rejects a hash with an empty digest instead of matching any password", () => {
    expect(verifyPassword("anything", "scrypt$16384$8$1$aabbcc$")).toBe(false);
    expect(verifyPassword("", "scrypt$16384$8$1$aabbcc$")).toBe(false);
  });

  it("rejects hashes with a wrong scheme or zero cost parameters", () => {
    const hash = hashPassword("hunter2");
    expect(verifyPassword("hunter2", hash.replace("scrypt", "bcrypt"))).toBe(false);
    expect(verifyPassword("hunter2", "scrypt$0$8$1$aabbcc$ddee")).toBe(false);
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
