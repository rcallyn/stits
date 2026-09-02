import { describe, expect, it } from "vitest";
import {
  canvasSyncRequestSchema,
  eventCreateSchema,
  eventPatchSchema,
  noteCreateSchema,
  settingsPatchSchema,
  todoPatchSchema,
} from "@/lib/schemas";

describe("eventCreateSchema", () => {
  it("accepts a minimal valid event and trims the title", () => {
    const parsed = eventCreateSchema.parse({ title: "  Standup  ", date: "2026-09-02" });
    expect(parsed).toEqual({ title: "Standup", date: "2026-09-02" });
  });

  it("strips unknown keys (e.g. a virtual recurring-instance id)", () => {
    const parsed = eventCreateSchema.parse({
      id: "x::2026-09-02",
      isRecurringInstance: true,
      title: "x",
      date: "2026-09-02",
    });
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("isRecurringInstance");
  });

  it("rejects a malformed date, bad time, unknown category, and empty title", () => {
    expect(eventCreateSchema.safeParse({ title: "x", date: "09/02/2026" }).success).toBe(false);
    expect(eventCreateSchema.safeParse({ title: "x", date: "2026-09-02", time: "25:00" }).success).toBe(
      false
    );
    expect(
      eventCreateSchema.safeParse({ title: "x", date: "2026-09-02", category: "bogus" }).success
    ).toBe(false);
    expect(eventCreateSchema.safeParse({ title: "   ", date: "2026-09-02" }).success).toBe(false);
  });

  it("allows an empty-string time for all-day events", () => {
    expect(eventCreateSchema.safeParse({ title: "x", date: "2026-09-02", time: "" }).success).toBe(
      true
    );
  });
});

describe("patch schemas keep the key-present distinction", () => {
  it("todoPatchSchema drops absent keys but keeps explicit nulls", () => {
    const parsed = todoPatchSchema.parse({ done: true, dueDate: null });
    expect("done" in parsed).toBe(true);
    expect("dueDate" in parsed).toBe(true);
    expect("title" in parsed).toBe(false);
  });

  it("eventPatchSchema rejects an out-of-range recurrence interval", () => {
    expect(
      eventPatchSchema.safeParse({ recurrence: { freq: "daily", interval: 0 } }).success
    ).toBe(false);
  });
});

describe("settingsPatchSchema", () => {
  it("rejects a category color record with an unknown category key", () => {
    expect(settingsPatchSchema.safeParse({ categoryColors: { school: "#fff" } }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ categoryColors: { nope: "#fff" } }).success).toBe(false);
  });
});

describe("misc endpoint schemas", () => {
  it("noteCreateSchema requires a non-empty text and a known tag", () => {
    expect(noteCreateSchema.safeParse({ text: "hi", tag: "house" }).success).toBe(true);
    expect(noteCreateSchema.safeParse({ text: "", tag: "house" }).success).toBe(false);
  });

  it("canvasSyncRequestSchema requires a feedUrl string", () => {
    expect(canvasSyncRequestSchema.safeParse({ feedUrl: "https://x.instructure.com/f.ics" }).success).toBe(
      true
    );
    expect(canvasSyncRequestSchema.safeParse({}).success).toBe(false);
  });
});
