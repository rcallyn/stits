"use client";

import { FormEvent, useState } from "react";
import Modal from "@/components/Modal";
import { PRIORITY_META, Subtask, Todo, TodoPriority } from "@/lib/todos";
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
  const [priority, setPriority] = useState<TodoPriority | "">(todo.priority ?? "");
  const [subtasks, setSubtasks] = useState<Subtask[]>(todo.subtasks ?? []);
  const [newSubtask, setNewSubtask] = useState("");

  function addSubtask() {
    const trimmed = newSubtask.trim();
    if (!trimmed) return;
    setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), title: trimmed, done: false }]);
    setNewSubtask("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(todo.id, {
      title: title.trim(),
      dueDate: dueDate || undefined,
      done,
      category: isCategory(category) ? category : undefined,
      priority: priority || undefined,
      subtasks: subtasks.length ? subtasks : undefined,
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
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TodoPriority | "")}
              className={fieldClass}
            >
              <option value="">None</option>
              {(Object.keys(PRIORITY_META) as TodoPriority[]).map((key) => (
                <option key={key} value={key}>
                  {PRIORITY_META[key].label}
                </option>
              ))}
            </select>
          </label>
        </div>

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

        <div className="flex flex-col gap-2 rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145]">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Subtasks</p>
          {subtasks.map((subtask) => (
            <div key={subtask.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={subtask.done}
                onChange={() =>
                  setSubtasks((prev) =>
                    prev.map((s) => (s.id === subtask.id ? { ...s, done: !s.done } : s))
                  )
                }
                className="h-3.5 w-3.5 shrink-0"
              />
              <span className={`flex-1 text-sm ${subtask.done ? "line-through text-zinc-400" : ""}`}>
                {subtask.title}
              </span>
              <button
                type="button"
                onClick={() => setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id))}
                className="shrink-0 text-xs text-zinc-400 transition-colors hover:text-red-500"
                aria-label={`Remove subtask ${subtask.title}`}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubtask();
                }
              }}
              placeholder="Add a subtask…"
              className={`${fieldClass} flex-1 text-sm`}
            />
            <button
              type="button"
              onClick={addSubtask}
              className="shrink-0 rounded-md border border-black/[.12] px-3 text-sm dark:border-white/[.145]"
            >
              Add
            </button>
          </div>
        </div>

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
