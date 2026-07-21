import { Category } from "@/lib/categories";

export type NoteTag = Category | "other";

export type Note = {
  id: string;
  text: string;
  tag: NoteTag;
  otherTitle?: string; // only set when tag === "other"
  createdAt: string; // ISO timestamp
};

export const NOTES_STORAGE_KEY = "stits:notes";

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function formatNoteTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
