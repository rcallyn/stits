import { describe, expect, it } from "vitest";
import { Note, sortNotes } from "@/lib/notes";

function note(partial: Partial<Note> & { id: string }): Note {
  return { text: "n", tag: "other", createdAt: "2026-09-01T00:00:00.000Z", ...partial };
}

describe("sortNotes", () => {
  it("puts pinned notes first, then newest-created first", () => {
    const out = sortNotes([
      note({ id: "old", createdAt: "2026-09-01T00:00:00.000Z" }),
      note({ id: "new", createdAt: "2026-09-05T00:00:00.000Z" }),
      note({ id: "pinned-old", pinned: true, createdAt: "2026-08-01T00:00:00.000Z" }),
    ]);
    expect(out.map((n) => n.id)).toEqual(["pinned-old", "new", "old"]);
  });

  it("does not mutate its input", () => {
    const input = [note({ id: "a" }), note({ id: "b", pinned: true })];
    sortNotes(input);
    expect(input.map((n) => n.id)).toEqual(["a", "b"]);
  });
});
