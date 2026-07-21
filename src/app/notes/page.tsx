"use client";

import { FormEvent, useState } from "react";
import { useNotes } from "@/hooks/useNotes";
import { NoteTag, formatNoteTimestamp } from "@/lib/notes";
import { CATEGORY_LIST } from "@/lib/categories";
import CategoryBadge from "@/components/CategoryBadge";

const fieldClass =
  "rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] dark:border-white/[.145] dark:focus:border-white/[.4]";

export default function NotesPage() {
  const { notes, loaded, addNote, removeNote } = useNotes();
  const [text, setText] = useState("");
  const [tag, setTag] = useState<NoteTag>(CATEGORY_LIST[0][0]);
  const [otherTitle, setOtherTitle] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    addNote({
      text: text.trim(),
      tag,
      otherTitle: tag === "other" ? otherTitle.trim() || undefined : undefined,
    });
    setText("");
    setOtherTitle("");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Jot something down and tag it.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]"
      >
        <label className="flex flex-col gap-1 text-sm">
          Note
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            required
            rows={3}
            className={`${fieldClass} resize-none`}
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Tag
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value as NoteTag)}
              className={fieldClass}
            >
              {CATEGORY_LIST.map(([key, style]) => (
                <option key={key} value={key}>
                  {style.label}
                </option>
              ))}
              <option value="other">Other</option>
            </select>
          </label>

          {tag === "other" && (
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Title
              <input
                type="text"
                value={otherTitle}
                onChange={(e) => setOtherTitle(e.target.value)}
                placeholder="e.g. Travel"
                className={fieldClass}
              />
            </label>
          )}

          <button
            type="submit"
            className="h-10 shrink-0 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Add note
          </button>
        </div>
      </form>

      {loaded && notes.length === 0 && (
        <div className="rounded-lg border border-dashed border-black/[.12] p-8 text-center text-sm text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
          No notes yet.
        </div>
      )}

      {notes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex flex-col gap-2 rounded-lg border border-black/[.08] px-4 py-3 dark:border-white/[.145]"
            >
              <div className="flex items-center justify-between gap-2">
                {note.tag === "other" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[.06] px-2 py-0.5 text-[11px] font-medium dark:bg-white/[.1]">
                    {note.otherTitle || "Other"}
                  </span>
                ) : (
                  <CategoryBadge category={note.tag} />
                )}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400">
                    {formatNoteTimestamp(note.createdAt)}
                  </span>
                  <button
                    onClick={() => removeNote(note.id)}
                    className="text-sm text-zinc-400 transition-colors hover:text-red-500"
                    aria-label="Remove note"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="text-sm">{note.text}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
