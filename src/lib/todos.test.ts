import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isOverdue, sortTodos, subtaskProgress, Todo } from "@/lib/todos";

function todo(partial: Partial<Todo> & { id: string }): Todo {
  return { title: "t", done: false, ...partial };
}

describe("isOverdue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 2));
  });
  afterEach(() => vi.useRealTimers());

  it("is true only for an incomplete todo with a past due date", () => {
    expect(isOverdue({ dueDate: "2026-09-01", done: false })).toBe(true);
    expect(isOverdue({ dueDate: "2026-09-02", done: false })).toBe(false); // due today
    expect(isOverdue({ dueDate: "2026-09-01", done: true })).toBe(false);
    expect(isOverdue({ done: false })).toBe(false);
  });
});

describe("subtaskProgress", () => {
  it("counts done vs total", () => {
    expect(subtaskProgress({})).toEqual({ done: 0, total: 0 });
    expect(
      subtaskProgress({
        subtasks: [
          { id: "1", title: "a", done: true },
          { id: "2", title: "b", done: false },
          { id: "3", title: "c", done: true },
        ],
      })
    ).toEqual({ done: 2, total: 3 });
  });
});

describe("sortTodos", () => {
  it("orders incomplete before complete, then by priority, then by due date", () => {
    const out = sortTodos([
      todo({ id: "done", done: true, priority: "high" }),
      todo({ id: "low", priority: "low" }),
      todo({ id: "high-soon", priority: "high", dueDate: "2026-09-03" }),
      todo({ id: "high-later", priority: "high", dueDate: "2026-09-10" }),
      todo({ id: "no-priority" }),
    ]);
    expect(out.map((t) => t.id)).toEqual([
      "high-soon",
      "high-later",
      "low",
      "no-priority",
      "done",
    ]);
  });

  it("does not mutate its input", () => {
    const input = [todo({ id: "b", done: true }), todo({ id: "a" })];
    sortTodos(input);
    expect(input.map((t) => t.id)).toEqual(["b", "a"]);
  });
});
