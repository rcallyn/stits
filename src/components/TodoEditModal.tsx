"use client";

import { FormEvent, useState } from "react";
import Modal from "@/components/Modal";
import { Todo } from "@/lib/todos";
import { CATEGORY_LIST, isCategory } from "@/lib/categories";
import { useCategoryLabels } from "@/hooks/useCategoryLabels";

const fieldClass =
  "rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] dark:border-white/[.145] dark:focus:border-white/[.4]";

type Props = {
  todo: Todo;
  onSave: (id: string, changes: Partial<Omit<Todo, "id">>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export default function TodoEditModal({ todo, onSave, onDelete, onClose }: Props) {
  const { labelFor } = useCategoryLabels();
  const [title, setTitle] = useState(todo.title);
  const [dueDate, setDueDate] = useState(todo.dueDate ?? "");
  const [done, setDone] = useState(todo.done);
  const [category, setCategory] = useState(todo.category ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(todo.id, {
      title: title.trim(),
      dueDate: dueDate || undefined,
      done,
      category: isCategory(category) ? category : undefined,
    });
    onClose();
  }

  return (
    <Modal title="Edit todo" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={fieldClass}
          />
        </label>

        {todo.category && (
          <label className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={fieldClass}
            >
              {CATEGORY_LIST.map(([key]) => (
                <option key={key} value={key}>
                  {labelFor(key)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={done}
            onChange={(e) => setDone(e.target.checked)}
            className="h-4 w-4"
          />
          Done
        </label>

        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onDelete(todo.id);
              onClose();
            }}
            className="text-sm text-zinc-400 transition-colors hover:text-red-500"
          >
            Delete
          </button>
          <button
            type="submit"
            className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
