import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  baseEventId,
  eventDurationMinutes,
  expandRecurringEvents,
  isEventOnDate,
  layoutDayEvents,
  minutesToTime,
  ScheduleEvent,
  shiftISODate,
  sortEvents,
  timeToMinutes,
  todayISODate,
  truncateForTitle,
} from "@/lib/schedule";

function ev(partial: Partial<ScheduleEvent> & { id: string; date: string }): ScheduleEvent {
  return { title: "x", time: "", ...partial };
}

describe("shiftISODate", () => {
  it("adds and subtracts days across month boundaries", () => {
    expect(shiftISODate("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftISODate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftISODate("2024-03-01", -1)).toBe("2024-02-29"); // leap year
  });

  it("is a no-op for zero", () => {
    expect(shiftISODate("2026-09-02", 0)).toBe("2026-09-02");
  });
});

describe("isEventOnDate", () => {
  it("matches a single-day event only on its date", () => {
    expect(isEventOnDate({ date: "2026-09-02" }, "2026-09-02")).toBe(true);
    expect(isEventOnDate({ date: "2026-09-02" }, "2026-09-03")).toBe(false);
  });

  it("matches any day inside a multi-day span, inclusive", () => {
    const span = { date: "2026-09-02", endDate: "2026-09-05" };
    expect(isEventOnDate(span, "2026-09-02")).toBe(true);
    expect(isEventOnDate(span, "2026-09-04")).toBe(true);
    expect(isEventOnDate(span, "2026-09-05")).toBe(true);
    expect(isEventOnDate(span, "2026-09-06")).toBe(false);
  });

  it("ignores an endDate that precedes the start", () => {
    expect(isEventOnDate({ date: "2026-09-02", endDate: "2026-08-01" }, "2026-09-02")).toBe(true);
  });
});

describe("baseEventId", () => {
  it("strips a virtual occurrence suffix", () => {
    expect(baseEventId("abc::2026-09-02")).toBe("abc");
  });
  it("passes a plain id through", () => {
    expect(baseEventId("abc")).toBe("abc");
  });
});

describe("time helpers", () => {
  it("round-trips minutes and HH:MM", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(-5)).toBe("00:00");
    expect(minutesToTime(24 * 60)).toBe("23:59");
  });

  it("computes duration with a default and a floor", () => {
    expect(eventDurationMinutes(ev({ id: "a", date: "2026-09-02", time: "" }))).toBe(0);
    expect(eventDurationMinutes(ev({ id: "a", date: "2026-09-02", time: "09:00" }))).toBe(15);
    expect(
      eventDurationMinutes(ev({ id: "a", date: "2026-09-02", time: "09:00", endTime: "10:30" }))
    ).toBe(90);
    expect(
      eventDurationMinutes(ev({ id: "a", date: "2026-09-02", time: "09:00", endTime: "09:00" }))
    ).toBe(15); // clamped up to MIN_DURATION_MINUTES
  });
});

describe("sortEvents", () => {
  it("orders by date then time, all-day first", () => {
    const sorted = sortEvents([
      ev({ id: "b", date: "2026-09-03", time: "08:00" }),
      ev({ id: "a", date: "2026-09-02", time: "12:00" }),
      ev({ id: "c", date: "2026-09-02", time: "" }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate its input", () => {
    const input = [ev({ id: "b", date: "2026-09-03" }), ev({ id: "a", date: "2026-09-02" })];
    sortEvents(input);
    expect(input.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("truncateForTitle", () => {
  it("trims whitespace and leaves short strings alone", () => {
    expect(truncateForTitle("  hello  ")).toBe("hello");
  });
  it("adds an ellipsis past the max length", () => {
    const out = truncateForTitle("x".repeat(80));
    expect(out).toHaveLength(60);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("layoutDayEvents", () => {
  it("keeps non-overlapping events in one column", () => {
    const positioned = layoutDayEvents([
      ev({ id: "a", date: "2026-09-02", time: "09:00", endTime: "10:00" }),
      ev({ id: "b", date: "2026-09-02", time: "10:00", endTime: "11:00" }),
    ]);
    expect(positioned.every((p) => p.columns === 1 && p.column === 0)).toBe(true);
  });

  it("splits overlapping events into side-by-side columns", () => {
    const positioned = layoutDayEvents([
      ev({ id: "a", date: "2026-09-02", time: "09:00", endTime: "10:30" }),
      ev({ id: "b", date: "2026-09-02", time: "10:00", endTime: "11:00" }),
    ]);
    const byId = Object.fromEntries(positioned.map((p) => [p.event.id, p]));
    expect(byId.a.columns).toBe(2);
    expect(byId.b.columns).toBe(2);
    expect(byId.a.column).not.toBe(byId.b.column);
  });
});

describe("expandRecurringEvents", () => {
  it("passes non-recurring events through untouched", () => {
    const events = [ev({ id: "a", date: "2026-09-02" })];
    expect(expandRecurringEvents(events, "2026-09-01", "2026-09-30")).toEqual(events);
  });

  it("expands a weekly series within the range", () => {
    const events = [
      ev({ id: "a", date: "2026-09-01", recurrence: { freq: "weekly", interval: 1 } }),
    ];
    const out = expandRecurringEvents(events, "2026-09-01", "2026-09-30");
    expect(out.map((e) => e.date)).toEqual([
      "2026-09-01",
      "2026-09-08",
      "2026-09-15",
      "2026-09-22",
      "2026-09-29",
    ]);
    expect(out.every((e) => e.isRecurringInstance)).toBe(true);
    expect(out[0].id).toBe("a::2026-09-01");
  });

  it("honours interval, until, and exceptions", () => {
    const events = [
      ev({
        id: "a",
        date: "2026-09-01",
        recurrence: {
          freq: "daily",
          interval: 2,
          until: "2026-09-09",
          exceptions: ["2026-09-05"],
        },
      }),
    ];
    const out = expandRecurringEvents(events, "2026-09-01", "2026-09-30");
    expect(out.map((e) => e.date)).toEqual(["2026-09-01", "2026-09-03", "2026-09-07", "2026-09-09"]);
  });

  it("expands a monthly series and clamps to the range end", () => {
    const events = [
      ev({ id: "a", date: "2026-01-15", recurrence: { freq: "monthly", interval: 1 } }),
    ];
    const out = expandRecurringEvents(events, "2026-01-01", "2026-04-30");
    expect(out.map((e) => e.date)).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
  });

  it("reaches a range far in the future without hitting the iteration guard", () => {
    const events = [
      ev({ id: "a", date: "2020-01-01", recurrence: { freq: "daily", interval: 1 } }),
    ];
    const out = expandRecurringEvents(events, "2026-09-01", "2026-09-03");
    expect(out.map((e) => e.date)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });
});

describe("todayISODate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("formats the local date as YYYY-MM-DD", () => {
    vi.setSystemTime(new Date(2026, 8, 2, 13, 0, 0));
    expect(todayISODate()).toBe("2026-09-02");
  });
});
