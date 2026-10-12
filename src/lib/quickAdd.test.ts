import { describe, expect, it } from "vitest";
import { ParsedItemSchema, parsedItemOutputFormat } from "@/lib/quickAdd";

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
