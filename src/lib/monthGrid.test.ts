import { describe, expect, it } from "vitest";
import { buildMonthGrid, monthLabel, shiftMonth, startOfWeek, weekDates, WEEKDAY_LETTERS } from "@/lib/monthGrid";

describe("buildMonthGrid", () => {
  it("returns full Sun-Sat weeks padded with adjacent-month days", () => {
    // September 2026 starts on a Tuesday and ends on a Wednesday.
    const weeks = buildMonthGrid(2026, 9);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toEqual({ date: "2026-08-30", day: 30, inMonth: false });
    expect(weeks[0][2]).toEqual({ date: "2026-09-01", day: 1, inMonth: true });
    expect(weeks[4][6]).toEqual({ date: "2026-10-03", day: 3, inMonth: false });
    expect(weeks.flat().filter((c) => c.inMonth)).toHaveLength(30);
  });

  it("adds no padding when the month fills whole weeks", () => {
    // February 2026 starts on a Sunday and has 28 days.
    const weeks = buildMonthGrid(2026, 2);
    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every((c) => c.inMonth)).toBe(true);
  });

  it("handles leap years and year boundaries", () => {
    expect(buildMonthGrid(2024, 2).flat().filter((c) => c.inMonth)).toHaveLength(29);
    const jan = buildMonthGrid(2026, 1);
    expect(jan[0][0].date).toBe("2025-12-28");
  });
});

describe("shiftMonth", () => {
  it("rolls over year boundaries in both directions", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 5, 0)).toEqual({ year: 2026, month: 5 });
    expect(shiftMonth(2026, 3, -15)).toEqual({ year: 2024, month: 12 });
  });
});

describe("startOfWeek / weekDates", () => {
  it("finds the Sunday on or before a date", () => {
    expect(startOfWeek("2026-09-02")).toBe("2026-08-30"); // Wednesday
    expect(startOfWeek("2026-08-30")).toBe("2026-08-30"); // already Sunday
    expect(startOfWeek("2026-01-01")).toBe("2025-12-28");
  });

  it("lists the seven days of the week containing a date", () => {
    expect(weekDates("2026-09-02")).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
    ]);
  });
});

describe("weekDates boundaries", () => {
  it("crosses year and leap-day boundaries", () => {
    expect(weekDates("2026-01-01")[0]).toBe("2025-12-28");
    expect(weekDates("2026-01-01")[6]).toBe("2026-01-03");
    expect(weekDates("2024-03-01")).toContain("2024-02-29");
  });

  it("returns seven consecutive days across a daylight-saving change", () => {
    const days = weekDates("2026-03-10"); // US spring-forward is 2026-03-08
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-03-08");
    expect(days[6]).toBe("2026-03-14");
  });
});

describe("shiftMonth large deltas", () => {
  it("handles multi-year shifts in both directions", () => {
    expect(shiftMonth(2026, 6, 24)).toEqual({ year: 2028, month: 6 });
    expect(shiftMonth(2026, 6, -30)).toEqual({ year: 2023, month: 12 });
  });
});

describe("monthLabel / WEEKDAY_LETTERS", () => {
  it("includes the year in the label", () => {
    expect(monthLabel(2026, 9)).toContain("2026");
    expect(monthLabel(2026, 9)).not.toBe(monthLabel(2026, 10));
  });

  it("has one letter per weekday, starting on Sunday", () => {
    expect(WEEKDAY_LETTERS).toHaveLength(7);
    expect(WEEKDAY_LETTERS[0]).toBe("S");
  });
});
