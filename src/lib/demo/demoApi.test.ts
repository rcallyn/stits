import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/lib/demo/demoData";
import { handleDemoRequest } from "@/lib/demo/demoApi";

const TODAY = "2026-10-21";

describe("handleDemoRequest: events", () => {
  it("creates events with the injected id and a default empty time", () => {
    const state = buildDemoData(TODAY);
    const res = handleDemoRequest(state, "POST", "/api/events", { title: "Study", date: TODAY }, () => "new-id");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ event: { id: "new-id", title: "Study", time: "" } });
    expect(state.events.some((e) => e.id === "new-id")).toBe(true);
  });

  it("drops a todoId that doesn't match any todo", () => {
    const state = buildDemoData(TODAY);
    handleDemoRequest(state, "POST", "/api/events", { title: "Ghost", date: TODAY, todoId: "00000000-0000-4000-8000-000000000000" }, () => "e1");
    expect(state.events.find((e) => e.id === "e1")).not.toHaveProperty("todoId");
  });

  it("deletes a recurring occurrence's whole series and rejects bad bodies", () => {
    const state = buildDemoData(TODAY);
    const series = state.events.find((e) => e.recurrence)!;
    handleDemoRequest(state, "DELETE", `/api/events/${encodeURIComponent(`${series.id}::${TODAY}`)}`, undefined);
    expect(state.events.some((e) => e.id === series.id)).toBe(false);
    expect(handleDemoRequest(state, "POST", "/api/events", { title: "" }).status).toBe(400);
  });
});

describe("handleDemoRequest: settings, quick add and account", () => {
  it("patches settings and returns the result", () => {
    const state = buildDemoData(TODAY);
    const res = handleDemoRequest(state, "PATCH", "/api/settings", { canvasFeedUrl: "https://example.com/feed.ics" });
    expect(res.status).toBe(200);
    expect(state.settings.canvasFeedUrl).toBe("https://example.com/feed.ics");
    expect(handleDemoRequest(state, "GET", "/api/settings", undefined).body).toBe(state.settings);
    expect(handleDemoRequest(state, "PATCH", "/api/settings", { categoryOrder: ["bogus"] }).status).toBe(400);
  });

  it("answers quick add: 400 for empty text, 200 with an item otherwise", () => {
    const state = buildDemoData(TODAY);
    expect(handleDemoRequest(state, "POST", "/api/quick-add", { text: "" }).status).toBe(400);
    const res = handleDemoRequest(state, "POST", "/api/quick-add", { text: "call grandma" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ item: { kind: "todo", title: "Call grandma" } });
  });

  it("serves a fake non-admin account and accepts logout", () => {
    const state = buildDemoData(TODAY);
    expect(handleDemoRequest(state, "GET", "/api/account", undefined).body).toMatchObject({ isAdmin: false });
    expect(handleDemoRequest(state, "PATCH", "/api/account", {}).status).toBe(403);
    expect(handleDemoRequest(state, "POST", "/api/logout", undefined).status).toBe(200);
    expect(handleDemoRequest(state, "POST", "/api/migrate", {}).status).toBe(403);
  });

  it("returns 404 for unknown routes", () => {
    const state = buildDemoData(TODAY);
    expect(handleDemoRequest(state, "GET", "/api/nope", undefined).status).toBe(404);
  });
});
