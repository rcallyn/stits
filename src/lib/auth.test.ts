import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { sqlMock, claimsMock } = vi.hoisted(() => ({ sqlMock: vi.fn(), claimsMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));
vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  getSessionClaims: claimsMock,
}));

const { rlMock, recordMock, verifyMock } = vi.hoisted(() => ({
  rlMock: vi.fn(),
  recordMock: vi.fn(),
  verifyMock: vi.fn(),
}));
vi.mock("@/lib/rateLimit", () => ({
  clientIp: () => "1.2.3.4",
  isRateLimited: rlMock,
  recordAttempt: recordMock,
}));
vi.mock("@/lib/password", () => ({ verifyPassword: verifyMock }));

import { checkCurrentPassword, normalizeEmail, requireAdmin, requireUser } from "@/lib/auth";

const req = { cookies: { get: () => ({ value: "cookie" }) } } as unknown as NextRequest;

const row = (isAdmin: boolean) => ({
  id: "u1",
  email: "a@b.co",
  is_admin: isAdmin,
  has_pushover: true,
  session_version: 3,
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Foo@Example.COM \n")).toBe("foo@example.com");
  });
});

describe("requireUser", () => {
  beforeEach(() => {
    sqlMock.mockReset();
    claimsMock.mockReset();
  });

  it("returns 401 without querying the database when the cookie has no valid claims", async () => {
    claimsMock.mockResolvedValue(null);
    const result = await requireUser(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 401 when no active user matches the claims", async () => {
    claimsMock.mockResolvedValue({ userId: "u1", version: 3 });
    sqlMock.mockResolvedValue([]);
    const result = await requireUser(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("maps the database row to a SessionUser", async () => {
    claimsMock.mockResolvedValue({ userId: "u1", version: 3 });
    sqlMock.mockResolvedValue([row(false)]);
    const result = await requireUser(req);
    expect(result).toEqual({
      ok: true,
      user: { id: "u1", email: "a@b.co", isAdmin: false, hasPushover: true, sessionVersion: 3 },
    });
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    sqlMock.mockReset();
    claimsMock.mockReset();
    claimsMock.mockResolvedValue({ userId: "u1", version: 3 });
  });

  it("returns 403 for a non-admin user", async () => {
    sqlMock.mockResolvedValue([row(false)]);
    const result = await requireAdmin(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("passes an admin through", async () => {
    sqlMock.mockResolvedValue([row(true)]);
    const result = await requireAdmin(req);
    expect(result.ok).toBe(true);
  });

  it("keeps the 401 for an unauthenticated request", async () => {
    sqlMock.mockResolvedValue([]);
    const result = await requireAdmin(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });
});

describe("checkCurrentPassword", () => {
  const user = { id: "u1", email: "a@b.co", isAdmin: false, hasPushover: false, sessionVersion: 1 };

  beforeEach(() => {
    sqlMock.mockReset();
    rlMock.mockReset();
    recordMock.mockReset();
    verifyMock.mockReset();
    rlMock.mockResolvedValue({ limited: false, retryAfterSeconds: 0 });
  });

  it("returns null and records nothing when the password is right", async () => {
    sqlMock.mockResolvedValue([{ password_hash: "hash" }]);
    verifyMock.mockReturnValue(true);
    expect(await checkCurrentPassword(req, user, "pw")).toBeNull();
    expect(verifyMock).toHaveBeenCalledWith("pw", "hash");
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("returns 401 and records a failed attempt for a wrong password", async () => {
    sqlMock.mockResolvedValue([{ password_hash: "hash" }]);
    verifyMock.mockReturnValue(false);
    const res = await checkCurrentPassword(req, user, "nope");
    expect(res?.status).toBe(401);
    expect(recordMock).toHaveBeenCalledWith("login", "1.2.3.4");
    expect(recordMock).toHaveBeenCalledWith("login-account", "a@b.co");
  });

  it("returns 401 when the user row is missing", async () => {
    sqlMock.mockResolvedValue([]);
    const res = await checkCurrentPassword(req, user, "pw");
    expect(res?.status).toBe(401);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After and skips the password check when rate limited", async () => {
    rlMock.mockResolvedValue({ limited: true, retryAfterSeconds: 42 });
    const res = await checkCurrentPassword(req, user, "pw");
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("42");
    expect(sqlMock).not.toHaveBeenCalled();
    expect(recordMock).not.toHaveBeenCalled();
  });
});
