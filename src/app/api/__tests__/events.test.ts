import { beforeEach, describe, expect, it, vi } from "vitest";
import { authedRequest, fakeDb, paramsOf, USER_ID } from "@/test/apiHarness";

vi.mock("@/lib/db", async () => (await import("@/test/apiHarness")).dbMock());

import { GET, POST } from "@/app/api/events/route";
import { DELETE, PATCH } from "@/app/api/events/[id]/route";

const EVENT_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => fakeDb.reset());

describe("GET /api/events", () => {
  it("rejects requests without a session cookie", async () => {
    const res = await GET(await authedRequest("/api/events", { cookie: false }));
    expect(res.status).toBe(401);
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("rejects a cookie whose session version was revoked", async () => {
    fakeDb.account.sessionVersion = 1; // "log out everywhere" happened
    const res = await GET(await authedRequest("/api/events", { version: 0 }));
    expect(res.status).toBe(401);
  });

  it("rejects a user who is no longer active", async () => {
    fakeDb.account.active = false;
    const res = await GET(await authedRequest("/api/events"));
    expect(res.status).toBe(401);
  });

  it("scopes the query to the signed-in user and maps rows to events", async () => {
    fakeDb.respond(() => [
      {
        id: EVENT_ID,
        title: "Gym",
        date: "2026-10-15",
        end_date: null,
        time: "07:00",
        end_time: null,
        todo_id: null,
        category: null,
        done: null,
        notes: null,
        is_note_event: null,
        recurrence: { freq: "weekly", interval: 1 },
        canvas_id: null,
      },
    ]);
    const res = await GET(await authedRequest("/api/events"));
    expect(res.status).toBe(200);
    const { events } = await res.json();
    expect(events).toEqual([
      {
        id: EVENT_ID,
        title: "Gym",
        date: "2026-10-15",
        time: "07:00",
        recurrence: { freq: "weekly", interval: 1 },
      },
    ]);
    expect(fakeDb.queries[0].text).toContain("where user_id = ?");
    expect(fakeDb.queries[0].values).toEqual([USER_ID]);
  });
});

describe("GET /api/events with a date range", () => {
  it("filters in SQL, scoped to the user, and keeps recurring events that haven't ended", async () => {
    const res = await GET(await authedRequest("/api/events?from=2026-10-01&to=2026-10-31"));
    expect(res.status).toBe(200);
    const q = fakeDb.queries[0];
    expect(q.text).toContain("user_id = ?");
    expect(q.text).toContain("recurrence is null");
    expect(q.values).toEqual([USER_ID, "2026-10-31", "2026-10-01", "2026-10-01"]);
  });

  it("returns everything when no range is given", async () => {
    await GET(await authedRequest("/api/events"));
    expect(fakeDb.queries[0].values).toEqual([USER_ID]);
  });

  it.each([
    "?from=2026-10-01",
    "?to=2026-10-31",
    "?from=nope&to=nope",
    "?from=2026-11-01&to=2026-10-01",
  ])("rejects a bad range %s before querying", async (qs) => {
    const res = await GET(await authedRequest(`/api/events${qs}`));
    expect(res.status).toBe(400);
    expect(fakeDb.queries).toHaveLength(0);
  });
});

describe("POST /api/events", () => {
  it("rejects invalid JSON and invalid fields with 400 before touching the database", async () => {
    const bad = await POST(await authedRequest("/api/events", { method: "POST", body: "{nope" }));
    expect(bad.status).toBe(400);
    const badDate = await POST(
      await authedRequest("/api/events", { method: "POST", body: { title: "x", date: "tomorrow" } })
    );
    expect(badDate.status).toBe(400);
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("inserts under the session's user id, ignoring any user id in the body", async () => {
    fakeDb.respond(() => [{ id: EVENT_ID, title: "Dentist", date: "2026-11-02", time: "" }]);
    const res = await POST(
      await authedRequest("/api/events", {
        method: "POST",
        body: { title: "Dentist", date: "2026-11-02", userId: "someone-else" },
      })
    );
    expect(res.status).toBe(200);
    const insert = fakeDb.queries[0];
    expect(insert.text).toContain("insert into schedule_events");
    expect(insert.values[0]).toBe(USER_ID);
    expect(insert.values).not.toContain("someone-else");
  });

  it("only links a todo through a subquery scoped to the same user", async () => {
    fakeDb.respond(() => [{ id: EVENT_ID, title: "x", date: "2026-11-02", time: "" }]);
    const todoId = "44444444-4444-4444-8444-444444444444";
    await POST(
      await authedRequest("/api/events", {
        method: "POST",
        body: { title: "x", date: "2026-11-02", todoId },
      })
    );
    // The nested `(select id from todos ...)` fragment is recorded as its own
    // query; it must filter by the session's user, not just the todo id.
    const nested = fakeDb.queries.find((q) => q.text.includes("from todos where id"));
    expect(nested?.text).toContain("user_id = ?");
    expect(nested?.values).toEqual([todoId, USER_ID]);
  });
});

describe("PATCH/DELETE /api/events/[id]", () => {
  it("rejects ids that aren't UUIDs", async () => {
    const res = await PATCH(
      await authedRequest("/api/events/abc", { method: "PATCH", body: { title: "x" } }),
      paramsOf("abc")
    );
    expect(res.status).toBe(400);
    const del = await DELETE(await authedRequest("/api/events/abc", { method: "DELETE" }), paramsOf("abc"));
    expect(del.status).toBe(400);
  });

  it("refuses an empty patch", async () => {
    const res = await PATCH(
      await authedRequest(`/api/events/${EVENT_ID}`, { method: "PATCH", body: {} }),
      paramsOf(EVENT_ID)
    );
    expect(res.status).toBe(400);
  });

  it("updates only rows owned by the user, resolving a recurrence-instance id to its base event", async () => {
    const res = await PATCH(
      await authedRequest(`/api/events/${EVENT_ID}::2026-10-22`, { method: "PATCH", body: { title: "Moved" } }),
      paramsOf(`${EVENT_ID}::2026-10-22`)
    );
    expect(res.status).toBe(200);
    const update = fakeDb.queries[0];
    expect(update.text).toContain("update schedule_events set");
    expect(update.text).toContain("and user_id = ?");
    expect(update.values.slice(-2)).toEqual([EVENT_ID, USER_ID]);
  });

  it("deletes scoped to the user and requires auth", async () => {
    const anon = await DELETE(
      await authedRequest(`/api/events/${EVENT_ID}`, { method: "DELETE", cookie: false }),
      paramsOf(EVENT_ID)
    );
    expect(anon.status).toBe(401);
    expect(fakeDb.queries).toHaveLength(0);

    const res = await DELETE(await authedRequest(`/api/events/${EVENT_ID}`, { method: "DELETE" }), paramsOf(EVENT_ID));
    expect(res.status).toBe(200);
    expect(fakeDb.queries[0].values).toContain(USER_ID);
    expect(fakeDb.queries[0].values).toContain(EVENT_ID);
  });
});
