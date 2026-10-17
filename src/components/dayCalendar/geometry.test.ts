import { describe, expect, it } from "vitest";
import { ScheduleEvent } from "@/lib/schedule";
import {
  DEFAULT_END_HOUR,
  DEFAULT_START_HOUR,
  PX_PER_MINUTE,
  formatHour,
  minutesFromClientY,
  visibleHourRange,
} from "./geometry";

function ev(time: string, endTime?: string): ScheduleEvent {
  return { id: time, title: "x", date: "2026-01-05", time, endTime };
}

describe("visibleHourRange", () => {
  it("defaults to 7am–9pm with no timed events", () => {
    expect(visibleHourRange([])).toEqual({ startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR });
  });

  it("keeps the default for events inside it", () => {
    expect(visibleHourRange([ev("09:00", "10:00")])).toEqual({ startHour: 7, endHour: 21 });
  });

  it("widens for early and late events", () => {
    expect(visibleHourRange([ev("05:30", "06:00"), ev("22:00", "23:15")])).toEqual({
      startHour: 5,
      endHour: 24,
    });
  });
});

describe("minutesFromClientY", () => {
  const start = 7 * 60;
  const end = 21 * 60;

  it("maps the grid top to the range start", () => {
    expect(minutesFromClientY(100, 100, start, end)).toBe(start);
  });

  it("snaps to 15 minutes", () => {
    // 20 minutes below the top rounds to 15
    expect(minutesFromClientY(100 + 20 * PX_PER_MINUTE, 100, start, end)).toBe(start + 15);
  });

  it("clamps above the grid and below it (leaving room for a minimum-length event)", () => {
    expect(minutesFromClientY(-500, 100, start, end)).toBe(start);
    expect(minutesFromClientY(99999, 100, start, end)).toBeLessThan(end);
  });
});

describe("formatHour", () => {
  it("formats 12-hour labels", () => {
    expect(formatHour(0)).toBe("12 AM");
    expect(formatHour(7)).toBe("7 AM");
    expect(formatHour(12)).toBe("12 PM");
    expect(formatHour(15)).toBe("3 PM");
  });
});
