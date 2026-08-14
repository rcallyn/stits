import { Category } from "@/lib/categories";

export type NoteTag = Category;

export type Note = {
  id: string;
  text: string;
  tag: NoteTag;
  createdAt: string; // ISO timestamp
  pinned?: boolean;
};

export const NOTES_STORAGE_KEY = "stits:notes";

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function formatNoteTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
