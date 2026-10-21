import { describe, expect, it } from "vitest";
import {
  CanvasAssignment,
  isoToDateInZone,
  LinkedEvent,
  planCanvasSync,
  shortenCourseTag,
  SyncedTodo,
} from "@/lib/canvasSync";

const TODAY = "2026-10-11";

function plan(overrides: {
  assignments?: CanvasAssignment[];
  todos?: SyncedTodo[];
  events?: LinkedEvent[];
  dismissedTodos?: string[];
  dismissedEvents?: string[];
}) {
  return planCanvasSync({
    assignments: overrides.assignments ?? [],
    todos: overrides.todos ?? [],
    events: overrides.events ?? [],
    dismissedTodos: new Set(overrides.dismissedTodos ?? []),
    dismissedEvents: new Set(overrides.dismissedEvents ?? []),
    today: TODAY,
  });
}

const hw1: CanvasAssignment = { canvasId: "event-assignment-1", title: "HW 1", dueDate: "2026-10-14" };
const hw1Todo: SyncedTodo = { id: "t1", canvasId: hw1.canvasId, title: "HW 1", dueDate: "2026-10-14", done: false };

describe("planCanvasSync", () => {
  it("creates a todo for a new upcoming assignment", () => {
    expect(plan({ assignments: [hw1] }).createTodos).toEqual([hw1]);
  });

  it("skips a new assignment that's already past due", () => {
    const old = { ...hw1, dueDate: "2026-10-10" };
    expect(plan({ assignments: [old] }).createTodos).toEqual([]);
  });

  it("does not re-add an assignment the user deleted", () => {
    expect(plan({ assignments: [hw1], dismissedTodos: [hw1.canvasId] }).createTodos).toEqual([]);
  });

  it("only updates an existing todo when Canvas changed it", () => {
    const events: LinkedEvent[] = [{ id: "e1", todoId: "t1", canvasId: hw1.canvasId, title: "HW 1", date: "2026-10-14" }];
    expect(plan({ assignments: [hw1], todos: [hw1Todo], events }).updateTodos).toEqual([]);

    const moved = { ...hw1, dueDate: "2026-10-16" };
    const result = plan({ assignments: [moved], todos: [hw1Todo], events });
    expect(result.updateTodos).toEqual([{ id: "t1", title: "HW 1", dueDate: "2026-10-16" }]);
    expect(result.updateEvents).toEqual([{ id: "e1", title: "HW 1", date: "2026-10-16" }]);
  });

  it("adds a missing calendar entry unless the user deleted it", () => {
    expect(plan({ assignments: [hw1], todos: [hw1Todo] }).createEvents).toEqual([
      { todoId: "t1", canvasId: hw1.canvasId, title: "HW 1", date: "2026-10-14" },
    ]);
    expect(
      plan({ assignments: [hw1], todos: [hw1Todo], dismissedEvents: [hw1.canvasId] }).createEvents
    ).toEqual([]);
  });

  it("doesn't backfill calendar entries for past-due assignments", () => {
    const past = { ...hw1, dueDate: "2026-10-01" };
    const todo = { ...hw1Todo, dueDate: "2026-10-01" };
    expect(plan({ assignments: [past], todos: [todo] }).createEvents).toEqual([]);
  });

  it("leaves a hand-scheduled calendar entry alone", () => {
    const events: LinkedEvent[] = [{ id: "e9", todoId: "t1", canvasId: null, title: "HW 1", date: "2026-10-12" }];
    const result = plan({ assignments: [{ ...hw1, title: "HW 1 (revised)" }], todos: [hw1Todo], events });
    expect(result.createEvents).toEqual([]);
    expect(result.updateEvents).toEqual([]);
  });

  it("removes open todos that vanished from the feed, but keeps completed ones", () => {
    const done = { ...hw1Todo, id: "t2", canvasId: "event-assignment-2", done: true };
    const result = plan({ assignments: [], todos: [hw1Todo, done] });
    expect(result.deleteTodoIds).toEqual(["t1"]);
  });

  it("doesn't remove todos due outside the sync window", () => {
    const old = { ...hw1Todo, dueDate: "2026-08-01" };
    expect(plan({ assignments: [], todos: [old] }).deleteTodoIds).toEqual([]);
  });
});

describe("isoToDateInZone", () => {
  it("converts a UTC instant to the Eastern date", () => {
    // 11:59pm ET on Oct 14 is 03:59 UTC on Oct 15.
    expect(isoToDateInZone("2026-10-15T03:59:00Z")).toBe("2026-10-14");
    expect(isoToDateInZone("2026-10-14T23:59:00Z")).toBe("2026-10-14");
  });

  it("passes a plain date through", () => {
    expect(isoToDateInZone("2026-10-14")).toBe("2026-10-14");
  });
});

describe("shortenCourseTag", () => {
  it("takes the course from the SIS id, even when cross-listed", () => {
    expect(
      shortenCourseTag(
        "Quiz 04 [MATH/STAT 418, Section 001: Prob and Stoc Proc. FA26 (22681--UP---P-STAT----418-------001-)]"
      )
    ).toBe("Quiz 04 [STAT 418]");
    expect(
      shortenCourseTag("P2 [CMPSC 311 - Fall 2026: Intro Sys Progmg (22681--UP---P-CMPSC---311-------002-)]")
    ).toBe("P2 [CMPSC 311]");
  });

  it("falls back to the first course code in the name", () => {
    expect(shortenCourseTag("hw4 [CMPEN/EE 362: Communication Networks]")).toBe("hw4 [CMPEN 362]");
    expect(shortenCourseTag("HW 5 [Section Merge: EE310_AllSections_Fall2026]")).toBe("HW 5 [EE 310]");
  });

  it("leaves a title alone when there's no recognisable course code", () => {
    expect(shortenCourseTag("Reading [Fall 2026 Seminar]")).toBe("Reading [Fall 2026 Seminar]");
    expect(shortenCourseTag("HW 1")).toBe("HW 1");
  });

  it("uses the user's own spelling for a department", () => {
    const labels = { CMPSC: "CMPSCI" };
    expect(
      shortenCourseTag("P2 [CMPSC 311 - Fall 2026: Intro Sys Progmg (22681--UP---P-CMPSC---311-------002-)]", labels)
    ).toBe("P2 [CMPSCI 311]");
    expect(shortenCourseTag("hw4 [CMPEN/EE 362: Communication Networks]", labels)).toBe("hw4 [CMPEN 362]");
    expect(shortenCourseTag("P2 [CMPSCI 311]", labels)).toBe("P2 [CMPSCI 311]");
  });

  it("is a no-op on an already shortened title", () => {
    expect(shortenCourseTag("HW 5 [EE 310]")).toBe("HW 5 [EE 310]");
  });
});
