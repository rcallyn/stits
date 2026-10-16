import { describe, expect, it } from "vitest";
import { DayPlan, formatEveningRecap, formatMorningDigest } from "@/lib/digest";
import { ScheduleEvent } from "@/lib/schedule";
import { Todo } from "@/lib/todos";

const TODAY = "2026-10-16";

function ev(title: string, time = ""): ScheduleEvent {
  return { id: title, title, date: TODAY, time };
}
function todo(title: string, dueDate: string): Todo {
  return { id: title, title, done: false, dueDate };
}
function plan(partial: Partial<DayPlan>): DayPlan {
  return { events: [], dueTodos: [], tomorrow: [], ...partial };
}

describe("formatEveningRecap", () => {
  it("returns null when nothing is left", () => {
    expect(formatEveningRecap(plan({ events: [ev("Gym", "07:00")] }), TODAY, 18 * 60)).toBeNull();
    expect(formatEveningRecap(plan({ tomorrow: [ev("Class", "09:00")] }), TODAY, 18 * 60)).toBeNull();
  });

  it("drops events that already started but keeps later and all-day ones", () => {
    const msg = formatEveningRecap(
      plan({ events: [ev("Gym", "07:00"), ev("Dinner", "19:30"), ev("Birthday")] }),
      TODAY,
      18 * 60
    )!;
    expect(msg).not.toContain("Gym");
    expect(msg).toContain("Dinner");
    expect(msg).toContain("All day: Birthday");
  });

  it("lists open todos, flags overdue ones, and previews tomorrow", () => {
    const msg = formatEveningRecap(
      plan({
        dueTodos: [todo("Old", "2026-10-10"), todo("Essay", TODAY)],
        tomorrow: [ev("Brunch"), ev("Lecture", "09:00")],
      }),
      TODAY,
      18 * 60
    )!;
    expect(msg).toContain("⚠ Old (overdue)");
    expect(msg).toContain("\nEssay");
    expect(msg).not.toContain("Essay (overdue)");
    expect(msg).toContain("Tomorrow:");
    expect(msg).toContain("Lecture");
    expect(msg).not.toContain("Brunch");
  });

  it("caps long lists with a +N more line", () => {
    const events = Array.from({ length: 13 }, (_, i) => ev(`E${i}`, "20:00"));
    expect(formatEveningRecap(plan({ events }), TODAY, 0)).toContain("+3 more");
  });
});

describe("formatMorningDigest", () => {
  it("says so when there are no events and omits the todo section", () => {
    const msg = formatMorningDigest(plan({}), TODAY);
    expect(msg).toContain("No events today.");
    expect(msg).not.toContain("Todos:");
  });

  it("lists events and todos", () => {
    const msg = formatMorningDigest(
      plan({ events: [ev("Standup", "09:00")], dueTodos: [todo("Pay rent", "2026-10-01")] }),
      TODAY
    );
    expect(msg).toContain("Standup");
    expect(msg).toContain("Todos:\n⚠ Pay rent (overdue)");
  });
});
