import { describe, expect, it } from "vitest";
import { buildDemoData, DEMO_CATEGORY_LABELS } from "@/lib/demo/demoData";
import { handleDemoRequest } from "@/lib/demo/demoApi";
import { parseQuickAddOffline } from "@/lib/demo/demoQuickAdd";
import { expandRecurringEvents } from "@/lib/schedule";
import { weekDates } from "@/lib/monthGrid";

// 2026-10-21 is a Wednesday.
const TODAY = "2026-10-21";

describe("buildDemoData", () => {
  const data = buildDemoData(TODAY);

  it("fills the current week with classes and extracurriculars", () => {
    const week = weekDates(TODAY);
    const occurrences = expandRecurringEvents(data.events, week[0], week[6]);
    const titles = new Set(occurrences.map((e) => e.title));
    expect(titles).toContain("CS 121 Lecture");
    expect(titles).toContain("Club soccer practice");
    expect(titles).toContain("Library front desk shift");
    expect(occurrences.filter((e) => e.title === "CS 121 Lecture")).toHaveLength(3);
  });

  it("links every event's todoId to a todo", () => {
    const ids = new Set(data.todos.map((t) => t.id));
    for (const event of data.events) {
      if (event.todoId) expect(ids).toContain(event.todoId);
    }
  });

  it("labels every category with an everyday name", () => {
    const labels = Object.values(data.settings.categoryLabels);
    expect(labels).toEqual(Object.values(DEMO_CATEGORY_LABELS));
    for (const hidden of ["Rush", "Lloyd", "House Management"]) expect(labels).not.toContain(hidden);
  });
});

describe("handleDemoRequest", () => {
  it("creates, patches, and deletes todos, cascading to linked events", () => {
    const state = buildDemoData(TODAY);
    const created = handleDemoRequest(state, "POST", "/api/todos", { title: "Buy stamps", category: "house" });
    const { todo } = created.body as { todo: { id: string } };
    expect(state.todos.find((t) => t.id === todo.id)).toMatchObject({ title: "Buy stamps", done: false });

    handleDemoRequest(state, "POST", "/api/events", { title: "Buy stamps", date: TODAY, todoId: todo.id });
    expect(state.events.some((e) => e.todoId === todo.id)).toBe(true);

    handleDemoRequest(state, "PATCH", `/api/todos/${todo.id}`, { done: true, priority: null });
    expect(state.todos.find((t) => t.id === todo.id)).toMatchObject({ done: true });

    handleDemoRequest(state, "DELETE", `/api/todos/${todo.id}`, undefined);
    expect(state.todos.some((t) => t.id === todo.id)).toBe(false);
    expect(state.events.some((e) => e.todoId === todo.id)).toBe(false);
  });

  it("resolves a recurring occurrence id to its series", () => {
    const state = buildDemoData(TODAY);
    const series = state.events.find((e) => e.recurrence)!;
    handleDemoRequest(state, "PATCH", `/api/events/${series.id}::${TODAY}`, { title: "Renamed" });
    expect(state.events.find((e) => e.id === series.id)?.title).toBe("Renamed");
  });

  it("rejects invalid bodies with the real schemas", () => {
    const state = buildDemoData(TODAY);
    expect(handleDemoRequest(state, "POST", "/api/todos", { title: "" }).status).toBe(400);
    expect(handleDemoRequest(state, "POST", "/api/todos", { title: "x", category: "nope" }).status).toBe(400);
  });

  it("keeps account, Canvas, and admin changes off", () => {
    const state = buildDemoData(TODAY);
    expect(handleDemoRequest(state, "POST", "/api/canvas-sync", { feedUrl: "x" }).status).toBe(403);
    expect(handleDemoRequest(state, "POST", "/api/account/password", {}).status).toBe(403);
    expect(handleDemoRequest(state, "GET", "/api/admin/users", undefined).status).toBe(403);
  });
});

describe("parseQuickAddOffline", () => {
  it("makes an event when there's a time", () => {
    expect(parseQuickAddOffline("Dentist tomorrow at 3pm", TODAY)).toEqual({
      kind: "event",
      title: "Dentist",
      date: "2026-10-22",
      time: "15:00",
    });
  });

  it("reads a time range", () => {
    expect(parseQuickAddOffline("coffee with Sam friday 10-11am", TODAY)).toEqual({
      kind: "event",
      title: "Coffee with Sam",
      date: "2026-10-23",
      time: "10:00",
      endTime: "11:00",
    });
  });

  it("makes a todo with a due date when there's no time", () => {
    expect(parseQuickAddOffline("lab report due Friday", TODAY)).toEqual({
      kind: "todo",
      title: "Lab report",
      dueDate: "2026-10-23",
    });
    expect(parseQuickAddOffline("essay due next wednesday", TODAY)).toMatchObject({ dueDate: "2026-10-28" });
    expect(parseQuickAddOffline("call grandma", TODAY)).toEqual({ kind: "todo", title: "Call grandma" });
  });

  it("returns null for text with nothing left to title", () => {
    expect(parseQuickAddOffline("tomorrow", TODAY)).toBeNull();
  });
});
