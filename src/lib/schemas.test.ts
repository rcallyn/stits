import { describe, expect, it } from "vitest";
import {
  accountPatchSchema,
  canvasSyncRequestSchema,
  signupSchema,
  eventCreateSchema,
  eventPatchSchema,
  settingsPatchSchema,
  todoCreateSchema,
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
  it("todoCreateSchema accepts an optional description", () => {
    expect(todoCreateSchema.safeParse({ title: "x", description: "notes here" }).success).toBe(true);
    expect(todoCreateSchema.safeParse({ title: "x" }).success).toBe(true);
  });

  it("canvasSyncRequestSchema requires a feedUrl string", () => {
    expect(canvasSyncRequestSchema.safeParse({ feedUrl: "https://x.instructure.com/f.ics" }).success).toBe(
      true
    );
    expect(canvasSyncRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("requires a valid email and an 8+ character password", () => {
    expect(signupSchema.safeParse({ email: "a@b.co", password: "12345678" }).success).toBe(true);
    expect(signupSchema.safeParse({ email: "not-an-email", password: "12345678" }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "a@b.co", password: "1234567" }).success).toBe(false);
  });
});

describe("accountPatchSchema", () => {
  it("needs the current password, and accepts a 30-character Pushover key or null", () => {
    const key = "u".repeat(15) + "1".repeat(15);
    const currentPassword = "pw";
    expect(accountPatchSchema.parse({ currentPassword, pushoverUserKey: ` ${key} ` })).toEqual({
      currentPassword,
      pushoverUserKey: key,
    });
    expect(accountPatchSchema.safeParse({ currentPassword, pushoverUserKey: null }).success).toBe(true);
    expect(accountPatchSchema.safeParse({ currentPassword, pushoverUserKey: "short" }).success).toBe(false);
    expect(accountPatchSchema.safeParse({ currentPassword, pushoverUserKey: key + "!" }).success).toBe(false);
    expect(accountPatchSchema.safeParse({ pushoverUserKey: key }).success).toBe(false);
  });
});
