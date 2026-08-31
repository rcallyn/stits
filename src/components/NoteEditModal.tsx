"use client";

import { FormEvent, useState } from "react";
import Modal from "@/components/Modal";
import { Note } from "@/lib/notes";
import { CATEGORY_LIST } from "@/lib/categories";
import { useCategoryLabels } from "@/hooks/useCategoryLabels";

const fieldClass =
  "rounded-[10px] border border-black/[.06] bg-black/[.025] px-3 py-2 text-sm outline-none transition-colors focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 dark:border-white/[.08] dark:bg-white/[.05] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]/20";

type Props = {
  note: Note;
  onSave: (id: string, changes: Partial<Omit<Note, "id" | "createdAt">>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export default function NoteEditModal({ note, onSave, onDelete, onClose }: Props) {
  const { labelFor } = useCategoryLabels();
  const [text, setText] = useState(note.text);
  const [tag, setTag] = useState(note.tag);
  const [pinned, setPinned] = useState(Boolean(note.pinned));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSave(note.id, { text: text.trim(), tag, pinned: pinned || undefined });
    onClose();
  }

  return (
    <Modal title="Edit note" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          Note
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            rows={4}
            className={`${fieldClass} resize-none`}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          Tag
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value as Note["tag"])}
            className={fieldClass}
          >
            {CATEGORY_LIST.map(([key]) => (
              <option key={key} value={key}>
                {labelFor(key)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            className="h-4 w-4"
          />
          Pinned
        </label>

        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onDelete(note.id);
              onClose();
            }}
            className="text-sm text-zinc-400 transition-colors hover:text-red-500"
          >
            Delete
          </button>
          <button
            type="submit"
            className="h-10 rounded-lg bg-[#0071e3] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0077ed] active:bg-[#006edb]"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
