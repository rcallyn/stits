import { describe, expect, it } from "vitest";
import { ParsedItemSchema, parsedItemOutputFormat, buildQuickAddEvents, describeRepeat, type ParsedEvent } from "@/lib/quickAdd";

describe("ParsedItemSchema", () => {
  it("accepts an event with and without times", () => {
    expect(
      ParsedItemSchema.safeParse({ kind: "event", title: "Dentist", date: "2026-09-03", time: "15:00" }).success
    ).toBe(true);
    expect(
      ParsedItemSchema.safeParse({ kind: "event", title: "Holiday", date: "2026-09-03" }).success
    ).toBe(true);
  });

  it("accepts a todo with and without a due date", () => {
    expect(ParsedItemSchema.safeParse({ kind: "todo", title: "Buy milk" }).success).toBe(true);
    expect(
      ParsedItemSchema.safeParse({ kind: "todo", title: "Buy milk", dueDate: "2026-09-03" }).success
    ).toBe(true);
  });

  it("rejects unknown kinds and events without a date", () => {
    expect(ParsedItemSchema.safeParse({ kind: "note", title: "x" }).success).toBe(false);
    expect(ParsedItemSchema.safeParse({ kind: "event", title: "x" }).success).toBe(false);
  });
});

describe("parsedItemOutputFormat", () => {
  const format = parsedItemOutputFormat();

  it("produces a json_schema without $defs (the API rejects them next to anyOf)", () => {
    expect(format.type).toBe("json_schema");
    expect(JSON.stringify(format.schema)).not.toContain("$defs");
  });

  it("parses valid JSON output", () => {
    expect(format.parse('{"kind":"todo","title":"Buy milk"}')).toEqual({
      kind: "todo",
      title: "Buy milk",
    });
  });

  it("throws on invalid JSON and on schema mismatches", () => {
    expect(() => format.parse("not json")).toThrow(/parse structured output as JSON/);
    expect(() => format.parse('{"kind":"event","title":"x"}')).toThrow(/Failed to parse structured output/);
  });
});

describe("buildQuickAddEvents", () => {
  const ev = (over: Partial<ParsedEvent>): ParsedEvent => ({
    kind: "event",
    title: "Gym",
    date: "2026-10-13", // a Tuesday
    time: "07:00",
    ...over,
  });

  it("creates a plain one-off event", () => {
    expect(buildQuickAddEvents(ev({}))).toEqual([
      { title: "Gym", date: "2026-10-13", time: "07:00", endTime: undefined },
    ]);
  });

  it("creates one weekly series per weekday, anchored on the next matching date", () => {
    const out = buildQuickAddEvents(ev({ repeat: { freq: "weekly", weekdays: ["mon", "wed", "fri"] } }));
    expect(out.map((e) => e.date)).toEqual(["2026-10-14", "2026-10-16", "2026-10-19"]);
    for (const e of out) expect(e.recurrence).toEqual({ freq: "weekly", interval: 1 });
  });

  it("keeps the start date when the weekday matches", () => {
    const out = buildQuickAddEvents(ev({ repeat: { freq: "weekly", weekdays: ["tue"] } }));
    expect(out.map((e) => e.date)).toEqual(["2026-10-13"]);
  });

  it("supports intervals, until, and non-weekly frequencies", () => {
    expect(buildQuickAddEvents(ev({ repeat: { freq: "daily", interval: 2, until: "2026-11-01" } }))).toEqual([
      {
        title: "Gym",
        date: "2026-10-13",
        time: "07:00",
        endTime: undefined,
        recurrence: { freq: "daily", interval: 2, until: "2026-11-01" },
      },
    ]);
  });

  it("drops weekday series that start after `until`, and bad input", () => {
    const out = buildQuickAddEvents(
      ev({ repeat: { freq: "weekly", weekdays: ["wed", "fri"], until: "2026-10-14" } })
    );
    expect(out.map((e) => e.date)).toEqual(["2026-10-14"]);
    expect(buildQuickAddEvents(ev({ date: "tomorrow" }))).toEqual([]);
    expect(buildQuickAddEvents(ev({ time: "7am" }))[0].time).toBe("");
  });
});

describe("describeRepeat", () => {
  it("summarises the rule", () => {
    expect(describeRepeat({ freq: "weekly", weekdays: ["mon", "fri"] })).toBe("every week (mon/fri)");
    expect(describeRepeat({ freq: "daily", interval: 3, until: "2026-12-01" })).toBe(
      "every 3 days until 2026-12-01"
    );
  });
});
