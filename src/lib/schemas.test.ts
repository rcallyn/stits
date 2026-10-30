import { describe, expect, it } from "vitest";
import {
  accountPatchSchema,
  adminUserPatchSchema,
  attachedNoteSchema,
  categorySchema,
  backupImportSchema,
  passwordChangeSchema,
  canvasSyncRequestSchema,
  dateSchema,
  quickAddRequestSchema,
  recurrenceSchema,
  subtaskSchema,
  timeSchema,
  todoPrioritySchema,
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

describe("passwordChangeSchema", () => {
  it("needs the current password and an 8+ character new one", () => {
    expect(passwordChangeSchema.safeParse({ currentPassword: "old", newPassword: "12345678" }).success).toBe(true);
    expect(passwordChangeSchema.safeParse({ currentPassword: "old", newPassword: "1234567" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ currentPassword: "", newPassword: "12345678" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ newPassword: "12345678" }).success).toBe(false);
  });
});

describe("adminUserPatchSchema", () => {
  it("only allows activating a user", () => {
    expect(adminUserPatchSchema.safeParse({ status: "active" }).success).toBe(true);
    expect(adminUserPatchSchema.safeParse({ status: "disabled" }).success).toBe(false);
    expect(adminUserPatchSchema.safeParse({}).success).toBe(false);
  });
});

describe("backupImportSchema", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";

  it("accepts a minimal export and rows that carry their own uuid", () => {
    expect(backupImportSchema.safeParse({ todos: [], scheduleEvents: [] }).success).toBe(true);
    const full = backupImportSchema.safeParse({
      version: 1,
      todos: [{ id, title: "t", done: true, completedAt: "2026-09-02T12:00:00.000Z" }],
      scheduleEvents: [{ id, title: "e", date: "2026-09-02", time: "09:00" }],
      replace: true,
      confirm: "REPLACE ALL DATA",
    });
    expect(full.success).toBe(true);
  });

  it("requires both arrays and rejects rows without a valid uuid", () => {
    expect(backupImportSchema.safeParse({ todos: [] }).success).toBe(false);
    expect(backupImportSchema.safeParse({ scheduleEvents: [] }).success).toBe(false);
    expect(backupImportSchema.safeParse({ todos: [{ title: "t" }], scheduleEvents: [] }).success).toBe(false);
    expect(
      backupImportSchema.safeParse({ todos: [{ id: "nope", title: "t" }], scheduleEvents: [] }).success
    ).toBe(false);
  });

  it("rejects an unknown version", () => {
    expect(backupImportSchema.safeParse({ version: 2, todos: [], scheduleEvents: [] }).success).toBe(false);
  });
});

describe("dateSchema and timeSchema", () => {
  it("accepts YYYY-MM-DD dates and rejects other shapes", () => {
    expect(dateSchema.safeParse("2026-09-02").success).toBe(true);
    for (const bad of ["2026-9-2", "09/02/2026", "2026-09-02T10:00", "", " 2026-09-02"]) {
      expect(dateSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("accepts an empty string or HH:MM for times", () => {
    expect(timeSchema.safeParse("").success).toBe(true);
    expect(timeSchema.safeParse("09:30").success).toBe(true);
    for (const bad of ["9:30", "0930", "09:30:00", "noon"]) {
      expect(timeSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("subtaskSchema", () => {
  it("requires an id, a title string and a boolean done flag", () => {
    expect(subtaskSchema.safeParse({ id: "a", title: "", done: false }).success).toBe(true);
    expect(subtaskSchema.safeParse({ id: "", title: "x", done: false }).success).toBe(false);
    expect(subtaskSchema.safeParse({ id: "a", title: "x", done: "no" }).success).toBe(false);
    expect(subtaskSchema.safeParse({ id: "a", title: "x".repeat(501), done: true }).success).toBe(false);
  });
});

describe("recurrenceSchema", () => {
  it("accepts a rule with until and exceptions", () => {
    const rule = { freq: "weekly", interval: 2, until: "2026-12-01", exceptions: ["2026-10-06"] };
    expect(recurrenceSchema.parse(rule)).toEqual(rule);
  });

  it("rejects unknown frequencies and out-of-range or fractional intervals", () => {
    expect(recurrenceSchema.safeParse({ freq: "yearly", interval: 1 }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ freq: "daily", interval: 0 }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ freq: "daily", interval: 366 }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ freq: "daily", interval: 1.5 }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ freq: "daily", interval: 1, until: "soon" }).success).toBe(false);
  });
});

describe("quickAddRequestSchema", () => {
  it("trims the text and rejects blank or oversized input", () => {
    expect(quickAddRequestSchema.parse({ text: "  lunch at noon " }).text).toBe("lunch at noon");
    expect(quickAddRequestSchema.safeParse({ text: "   " }).success).toBe(false);
    expect(quickAddRequestSchema.safeParse({ text: "x".repeat(2001) }).success).toBe(false);
  });

  it("caps the history at 200 entries of 500 characters", () => {
    expect(quickAddRequestSchema.safeParse({ text: "a", history: Array(200).fill("h") }).success).toBe(true);
    expect(quickAddRequestSchema.safeParse({ text: "a", history: Array(201).fill("h") }).success).toBe(false);
    expect(quickAddRequestSchema.safeParse({ text: "a", history: ["h".repeat(501)] }).success).toBe(false);
  });
});

describe("attachedNoteSchema", () => {
  it("requires a non-empty id, keeps sourceNoteId and caps text at 10,000 characters", () => {
    expect(attachedNoteSchema.parse({ id: "n1", text: "hi", sourceNoteId: "s" })).toEqual({
      id: "n1",
      text: "hi",
      sourceNoteId: "s",
    });
    expect(attachedNoteSchema.safeParse({ id: "", text: "hi" }).success).toBe(false);
    expect(attachedNoteSchema.safeParse({ id: "n1", text: "x".repeat(10_000) }).success).toBe(true);
    expect(attachedNoteSchema.safeParse({ id: "n1", text: "x".repeat(10_001) }).success).toBe(false);
  });
});

describe("categorySchema and todoPrioritySchema", () => {
  it("accept only known values", () => {
    expect(categorySchema.safeParse("school").success).toBe(true);
    expect(categorySchema.safeParse("unknown").success).toBe(false);
    expect(categorySchema.safeParse("toString").success).toBe(false);
    expect(todoPrioritySchema.safeParse("medium").success).toBe(true);
    expect(todoPrioritySchema.safeParse("urgent").success).toBe(false);
  });
});

describe("todoCreateSchema and todoPatchSchema fields", () => {
  it("rejects a malformed due date and unknown priority on create", () => {
    expect(todoCreateSchema.safeParse({ title: "t", dueDate: "9/2/2026" }).success).toBe(false);
    expect(todoCreateSchema.safeParse({ title: "t", priority: "urgent" }).success).toBe(false);
  });

  it("allows nulling optional fields on patch but not the title", () => {
    const parsed = todoPatchSchema.parse({ description: null, priority: null, category: null, completedAt: null });
    expect(parsed).toEqual({ description: null, priority: null, category: null, completedAt: null });
    expect(todoPatchSchema.safeParse({ title: null }).success).toBe(false);
  });

  it("requires completedAt to be an ISO timestamp", () => {
    expect(todoPatchSchema.safeParse({ completedAt: "2026-09-02T10:00:00Z" }).success).toBe(true);
    expect(todoPatchSchema.safeParse({ completedAt: "yesterday" }).success).toBe(false);
  });
});
