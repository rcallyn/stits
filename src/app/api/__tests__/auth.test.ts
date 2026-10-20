import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { authedRequest, fakeDb, USER_ID } from "@/test/apiHarness";
import { hashPassword } from "@/lib/password";
import { PENDING_COOKIE_NAME, SESSION_COOKIE_NAME, getSessionClaims } from "@/lib/session";

vi.mock("@/lib/db", async () => (await import("@/test/apiHarness")).dbMock());
vi.mock("@/lib/pushover", () => ({
  sendPushoverNotification: vi.fn(async () => true),
  isValidPushoverUserKey: vi.fn(async () => true),
}));
// `after` only works inside a real request; run the callback inline instead.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => void fn(),
}));

import { POST as login } from "@/app/api/login/route";
import { POST as verify2fa } from "@/app/api/verify-2fa/route";
import { POST as signup } from "@/app/api/signup/route";
import { POST as changePassword } from "@/app/api/account/password/route";
import { sendPushoverNotification } from "@/lib/pushover";

const PASSWORD = "correct horse battery";
const pushMock = vi.mocked(sendPushoverNotification);

function userRow(over: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    password_hash: hashPassword(PASSWORD),
    status: "active",
    pushover_user_key: null,
    session_version: 3,
    ...over,
  };
}

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "9.9.9.9", ...headers },
    body: JSON.stringify(body),
  });
}

const cookieOf = (res: Response, name: string) => {
  const match = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  const value = match?.split(";")[0].slice(name.length + 1);
  return value === undefined ? value : decodeURIComponent(value);
};

beforeEach(() => {
  fakeDb.reset();
  pushMock.mockClear();
});

describe("POST /api/login", () => {
  it("rejects a malformed body without touching the user table", async () => {
    const res = await login(post("/api/login", { email: "a@b.co" }));
    expect(res.status).toBe(400);
    expect(fakeDb.queries.some((q) => q.text.includes("from users"))).toBe(false);
  });

  it("gives the same error for a wrong password and an unknown email, and counts the attempt", async () => {
    fakeDb.respond((q) => (q.text.includes("from users where email") ? [userRow()] : undefined));
    const wrong = await login(post("/api/login", { email: "me@example.com", password: "nope" }));
    fakeDb.respond(() => []);
    const unknown = await login(post("/api/login", { email: "who@example.com", password: "nope" }));
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(fakeDb.queries.filter((q) => q.text.includes("into login_attempts"))).toHaveLength(4);
  });

  it("signs in a 1FA user with a cookie carrying the stored session version", async () => {
    fakeDb.respond((q) => (q.text.includes("from users where email") ? [userRow()] : undefined));
    const res = await login(post("/api/login", { email: "  ME@Example.com ", password: PASSWORD }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, twoFactor: false });
    const claims = await getSessionClaims(cookieOf(res, SESSION_COOKIE_NAME));
    expect(claims).toEqual({ userId: USER_ID, version: 3 });
    const lookup = fakeDb.queries.find((q) => q.text.includes("from users where email"));
    expect(lookup?.values).toEqual(["me@example.com"]);
  });

  it("refuses a pending account only after the password is right", async () => {
    fakeDb.respond((q) => (q.text.includes("from users where email") ? [userRow({ status: "pending" })] : undefined));
    const ok = await login(post("/api/login", { email: "me@example.com", password: PASSWORD }));
    expect(ok.status).toBe(403);
    expect(cookieOf(ok, SESSION_COOKIE_NAME)).toBeUndefined();
    const bad = await login(post("/api/login", { email: "me@example.com", password: "wrong" }));
    expect(bad.status).toBe(401);
  });

  it("is throttled once the per-IP limit is reached", async () => {
    fakeDb.respond((q) =>
      q.text.includes("from login_attempts") ? [{ attempts: 8, window_start: new Date().toISOString() }] : undefined
    );
    const res = await login(post("/api/login", { email: "me@example.com", password: PASSWORD }));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(fakeDb.queries.some((q) => q.text.includes("from users"))).toBe(false);
  });

  it("starts 2FA for a Pushover user: pushes a code, sets only the pending cookie", async () => {
    fakeDb.respond((q) =>
      q.text.includes("from users where email") ? [userRow({ pushover_user_key: "k".repeat(30) })] : undefined
    );
    const res = await login(post("/api/login", { email: "me@example.com", password: PASSWORD }));
    expect(await res.json()).toEqual({ ok: true, twoFactor: true });
    expect(cookieOf(res, SESSION_COOKIE_NAME)).toBeUndefined();
    expect(cookieOf(res, PENDING_COOKIE_NAME)).toBeTruthy();
    expect(pushMock.mock.calls[0][1]).toMatch(/Your login code: \d{6}/);
  });

  it("fails with 502 and no cookie when the push can't be sent", async () => {
    pushMock.mockResolvedValueOnce(false);
    fakeDb.respond((q) =>
      q.text.includes("from users where email") ? [userRow({ pushover_user_key: "k".repeat(30) })] : undefined
    );
    const res = await login(post("/api/login", { email: "me@example.com", password: PASSWORD }));
    expect(res.status).toBe(502);
    expect(cookieOf(res, PENDING_COOKIE_NAME)).toBeUndefined();
  });
});

describe("POST /api/verify-2fa", () => {
  async function startTwoFactor() {
    fakeDb.respond((q) =>
      q.text.includes("from users where email") ? [userRow({ pushover_user_key: "k".repeat(30) })] : undefined
    );
    const res = await login(post("/api/login", { email: "me@example.com", password: PASSWORD }));
    const code = /(\d{6})/.exec(String(pushMock.mock.calls.at(-1)?.[1]))![1];
    return { pending: cookieOf(res, PENDING_COOKIE_NAME)!, code };
  }

  it("completes sign-in with the right code and clears the pending cookie", async () => {
    const { pending, code } = await startTwoFactor();
    fakeDb.respond((q) => (q.text.includes("select session_version") ? [{ session_version: 3 }] : undefined));
    const res = await verify2fa(post("/api/verify-2fa", { code }, { cookie: `${PENDING_COOKIE_NAME}=${pending}` }));
    expect(res.status).toBe(200);
    expect(await getSessionClaims(cookieOf(res, SESSION_COOKIE_NAME))).toEqual({ userId: USER_ID, version: 3 });
    expect(res.headers.getSetCookie().some((c) => c.startsWith(`${PENDING_COOKIE_NAME}=;`))).toBe(true);
  });

  it("rejects a wrong code, a missing pending cookie, and counts the failures", async () => {
    const { pending } = await startTwoFactor();
    fakeDb.queries.length = 0;
    const wrong = await verify2fa(post("/api/verify-2fa", { code: "000000" }, { cookie: `${PENDING_COOKIE_NAME}=${pending}` }));
    const none = await verify2fa(post("/api/verify-2fa", { code: "123456" }));
    expect(wrong.status).toBe(401);
    expect(none.status).toBe(401);
    expect(cookieOf(wrong, SESSION_COOKIE_NAME)).toBeUndefined();
    expect(fakeDb.queries.filter((q) => q.text.includes("into login_attempts"))).toHaveLength(2);
  });

  it("refuses when the account was deactivated in the meantime", async () => {
    const { pending, code } = await startTwoFactor();
    fakeDb.respond(() => []);
    const res = await verify2fa(post("/api/verify-2fa", { code }, { cookie: `${PENDING_COOKIE_NAME}=${pending}` }));
    expect(res.status).toBe(403);
    expect(cookieOf(res, SESSION_COOKIE_NAME)).toBeUndefined();
  });
});

describe("POST /api/signup", () => {
  it("creates a pending account and alerts admins", async () => {
    fakeDb.respond((q) => {
      if (q.text.includes("insert into users")) return [{ id: "new-id" }];
      if (q.text.includes("where is_admin")) return [{ pushover_user_key: "a".repeat(30) }];
      return undefined;
    });
    const res = await signup(post("/api/signup", { email: "New@Example.com", password: PASSWORD }));
    expect(res.status).toBe(200);
    const insert = fakeDb.queries.find((q) => q.text.includes("insert into users"))!;
    expect(insert.values[0]).toBe("new@example.com");
    expect(insert.values[1]).not.toBe(PASSWORD); // stored hashed
    expect(fakeDb.queries.some((q) => q.text.includes("insert into settings"))).toBe(true);
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));
  });

  it("answers identically for an already-registered email and sends no alert", async () => {
    const fresh = await signup(post("/api/signup", { email: "a@example.com", password: PASSWORD }));
    pushMock.mockClear();
    fakeDb.respond(() => []); // `on conflict do nothing` returns no row
    const dupe = await signup(post("/api/signup", { email: "a@example.com", password: PASSWORD }));
    expect(dupe.status).toBe(fresh.status);
    expect(await dupe.json()).toEqual(await fresh.json());
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("validates the body and throttles by IP", async () => {
    expect((await signup(post("/api/signup", { email: "nope", password: PASSWORD }))).status).toBe(400);
    expect((await signup(post("/api/signup", { email: "a@example.com", password: "short" }))).status).toBe(400);
    fakeDb.respond((q) =>
      q.text.includes("from login_attempts") ? [{ attempts: 5, window_start: new Date().toISOString() }] : undefined
    );
    expect((await signup(post("/api/signup", { email: "a@example.com", password: PASSWORD }))).status).toBe(429);
  });
});

describe("POST /api/account/password", () => {
  const body = { currentPassword: PASSWORD, newPassword: "a brand new password" };

  it("requires a session", async () => {
    const res = await changePassword(await authedRequest("/api/account/password", { method: "POST", body, cookie: false }));
    expect(res.status).toBe(401);
  });

  it("rejects a wrong current password without changing anything", async () => {
    fakeDb.respond((q) => (q.text.includes("select password_hash") ? [{ password_hash: hashPassword("other") }] : undefined));
    const res = await changePassword(await authedRequest("/api/account/password", { method: "POST", body }));
    expect(res.status).toBe(401);
    expect(fakeDb.queries.some((q) => q.text.includes("update users"))).toBe(false);
  });

  it("changes the password, bumps the session version, and re-issues this device's cookie", async () => {
    fakeDb.respond((q) => {
      if (q.text.includes("select password_hash")) return [{ password_hash: hashPassword(PASSWORD) }];
      if (q.text.includes("update users")) return [{ session_version: 1 }];
      return undefined;
    });
    const res = await changePassword(await authedRequest("/api/account/password", { method: "POST", body }));
    expect(res.status).toBe(200);
    const update = fakeDb.queries.find((q) => q.text.includes("update users"))!;
    expect(update.text).toContain("session_version = session_version + 1");
    expect(update.values[0]).not.toBe(body.newPassword);
    expect(await getSessionClaims(cookieOf(res, SESSION_COOKIE_NAME))).toEqual({ userId: USER_ID, version: 1 });
  });
});
