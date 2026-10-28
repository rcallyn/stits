import { describe, expect, it } from "vitest";
import { parseIcs } from "@/lib/ics";

const FEED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:event-assignment-12345",
  "SUMMARY:Read chapter 4\\, take notes",
  "DTSTART:20260904T235900Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:event-calendar-event-999",
  "SUMMARY:Lecture: intro to",
  "  algorithms",
  "DTSTART:20260905T140000Z",
  "DTEND:20260905T153000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:event-assignment-777",
  "SUMMARY:All-day quiz",
  "DTSTART;VALUE=DATE:20260906",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseIcs", () => {
  it("classifies assignment UIDs as todos and calendar-event UIDs as events", () => {
    const items = parseIcs(FEED);
    expect(items).toHaveLength(3);

    const todo = items[0];
    expect(todo).toMatchObject({
      kind: "todo",
      canvasId: "event-assignment-12345",
      title: "Read chapter 4, take notes",
      dueAtISO: "2026-09-04T23:59:00Z",
    });

    const event = items[1];
    expect(event).toMatchObject({
      kind: "event",
      canvasId: "event-calendar-event-999",
      title: "Lecture: intro to algorithms", // unfolded continuation line (one leading space is stripped)
      startAtISO: "2026-09-05T14:00:00Z",
      endAtISO: "2026-09-05T15:30:00Z",
      allDay: false,
    });
  });

  it("parses an all-day VALUE=DATE start", () => {
    const items = parseIcs(FEED);
    expect(items[2]).toMatchObject({ kind: "todo", dueAtISO: "2026-09-06" });
  });

  it("returns nothing for a feed with no VEVENTs", () => {
    expect(parseIcs("BEGIN:VCALENDAR\r\nEND:VCALENDAR")).toEqual([]);
  });

  it("skips a VEVENT missing a UID or SUMMARY", () => {
    const feed = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260905T140000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(parseIcs(feed)).toEqual([]);
  });
  const wrap = (...lines: string[]) =>
    ["BEGIN:VCALENDAR", "BEGIN:VEVENT", ...lines, "END:VEVENT", "END:VCALENDAR"].join("\r\n");

  it("skips a VEVENT with a missing or unparseable DTSTART", () => {
    expect(parseIcs(wrap("UID:event-assignment-1", "SUMMARY:No start"))).toEqual([]);
    expect(parseIcs(wrap("UID:event-assignment-1", "SUMMARY:Bad", "DTSTART:tomorrow"))).toEqual([]);
  });

  it("treats a floating time (no trailing Z) as UTC", () => {
    const items = parseIcs(wrap("UID:event-assignment-2", "SUMMARY:Floating", "DTSTART:20260905T140000"));
    expect(items[0]).toMatchObject({ kind: "todo", dueAtISO: "2026-09-05T14:00:00Z" });
  });

  it("marks a calendar event with a date-only start as all-day, with no end", () => {
    const items = parseIcs(wrap("UID:event-calendar-event-3", "SUMMARY:Holiday", "DTSTART;VALUE=DATE:20260907"));
    expect(items[0]).toMatchObject({ kind: "event", startAtISO: "2026-09-07", allDay: true, endAtISO: undefined });
  });

  it("unescapes commas, semicolons, backslashes and \\n in summaries", () => {
    const items = parseIcs(
      wrap("UID:event-assignment-4", "SUMMARY:a\\, b\\; c\\\\d\\ne", "DTSTART:20260905T140000Z"),
    );
    expect(items[0]).toMatchObject({ title: "a, b; c\\d e" });
  });

  it("accepts bare LF line endings and lowercase property names", () => {
    const feed = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nuid:event-assignment-5\nsummary:Lowercase\ndtstart:20260905T140000Z\nEND:VEVENT\nEND:VCALENDAR";
    expect(parseIcs(feed)).toHaveLength(1);
  });

  it("ignores properties outside a VEVENT", () => {
    const feed = "BEGIN:VCALENDAR\r\nUID:x\r\nSUMMARY:y\r\nDTSTART:20260905T140000Z\r\nEND:VCALENDAR";
    expect(parseIcs(feed)).toEqual([]);
  });
});
