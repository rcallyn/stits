import { beforeEach, describe, expect, it, vi } from "vitest";
import { authedRequest, fakeDb, paramsOf, USER_ID } from "@/test/apiHarness";

vi.mock("@/lib/db", async () => (await import("@/test/apiHarness")).dbMock());

import { GET, POST } from "@/app/api/todos/route";
import { DELETE, PATCH } from "@/app/api/todos/[id]/route";
import { POST as logoutAll } from "@/app/api/logout-all/route";
import { POST as logout } from "@/app/api/logout/route";

const TODO_ID = "55555555-5555-4555-8555-555555555555";

beforeEach(() => fakeDb.reset());

describe("/api/todos", () => {
  it("requires a session", async () => {
    expect((await GET(await authedRequest("/api/todos", { cookie: false }))).status).toBe(401);
    expect(
      (await POST(await authedRequest("/api/todos", { method: "POST", body: { title: "x" }, cookie: false }))).status
    ).toBe(401);
  });

  it("lists only the signed-in user's todos and maps columns to the client shape", async () => {
    fakeDb.respond(() => [
      {
        id: TODO_ID,
        title: "Essay",
        description: null,
        done: false,
        due_date: "2026-10-20",
        category: null,
        priority: "high",
        subtasks: null,
        completed_at: null,
        canvas_id: null,
      },
    ]);
    const res = await GET(await authedRequest("/api/todos"));
    expect((await res.json()).todos).toEqual([
      { id: TODO_ID, title: "Essay", done: false, dueDate: "2026-10-20", priority: "high" },
    ]);
    expect(fakeDb.queries[0].values).toEqual([USER_ID]);
  });

  it("validates the create body", async () => {
    for (const body of [{}, { title: "   " }, { title: "x", dueDate: "10/20" }, { title: "x", priority: "urgent" }]) {
      const res = await POST(await authedRequest("/api/todos", { method: "POST", body }));
      expect(res.status).toBe(400);
    }
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("creates a todo for the session's user", async () => {
    fakeDb.respond(() => [{ id: TODO_ID, title: "Read", done: false }]);
    const res = await POST(await authedRequest("/api/todos", { method: "POST", body: { title: " Read " } }));
    expect(res.status).toBe(200);
    expect(fakeDb.queries[0].values.slice(0, 2)).toEqual([USER_ID, "Read"]);
  });
});

describe("/api/todos/[id]", () => {
  it("rejects a malformed id and an empty patch", async () => {
    const badId = await PATCH(
      await authedRequest("/api/todos/1", { method: "PATCH", body: { done: true } }),
      paramsOf("1")
    );
    expect(badId.status).toBe(400);
    const empty = await PATCH(
      await authedRequest(`/api/todos/${TODO_ID}`, { method: "PATCH", body: {} }),
      paramsOf(TODO_ID)
    );
    expect(empty.status).toBe(400);
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("patches scoped to the user, mapping camelCase fields to columns", async () => {
    const res = await PATCH(
      await authedRequest(`/api/todos/${TODO_ID}`, { method: "PATCH", body: { dueDate: null, done: true } }),
      paramsOf(TODO_ID)
    );
    expect(res.status).toBe(200);
    const [update] = fakeDb.queries;
    expect(update.text).toContain("update todos set");
    expect(update.values.slice(-2)).toEqual([TODO_ID, USER_ID]);
    expect(update.values[0]).toEqual({ fragment: { done: true, due_date: null } });
  });

  it("deletes scoped to the user", async () => {
    const res = await DELETE(await authedRequest(`/api/todos/${TODO_ID}`, { method: "DELETE" }), paramsOf(TODO_ID));
    expect(res.status).toBe(200);
    expect(fakeDb.queries[0].text).toContain("delete from todos where id = ? and user_id = ?");
    expect(fakeDb.queries[0].values.slice(0, 2)).toEqual([TODO_ID, USER_ID]);
  });
});

describe("logout endpoints", () => {
  it("logout clears the cookie without a database call", async () => {
    const res = await logout();
    expect(res.cookies.get("stits_session")?.value).toBe("");
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("logout-all bumps the session version for this user only, then clears the cookie", async () => {
    const res = await logoutAll(await authedRequest("/api/logout-all", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(fakeDb.queries[0].text).toContain("session_version = session_version + 1");
    expect(fakeDb.queries[0].values).toEqual([USER_ID]);
    expect(res.cookies.get("stits_session")?.value).toBe("");
  });

  it("logout-all refuses an unauthenticated or already-revoked session", async () => {
    expect((await logoutAll(await authedRequest("/api/logout-all", { method: "POST", cookie: false }))).status).toBe(401);
    fakeDb.account.sessionVersion = 3;
    expect((await logoutAll(await authedRequest("/api/logout-all", { method: "POST", version: 2 }))).status).toBe(401);
    expect(fakeDb.queries).toHaveLength(0);
  });
});
