"use client";

import { FormEvent, useState } from "react";
import { useTodos } from "@/hooks/useTodos";
import { formatEventDate } from "@/lib/schedule";
import { Todo } from "@/lib/todos";
import { CATEGORY_LIST } from "@/lib/categories";
import TodoEditModal from "@/components/TodoEditModal";
import { resolveColor } from "@/lib/itemColor";

export default function OtherPage() {
  const { todos, loaded, addTodo, toggleTodo, updateTodo, removeTodo } = useTodos();
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Other</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Rush, career, school, and house management todos.
        </p>
      </div>

      {CATEGORY_LIST.map(([key, style]) => (
        <CategorySection
          key={key}
          label={style.label}
          loaded={loaded}
          todos={todos.filter((todo) => todo.category === key)}
          onAdd={(title, dueDate) => addTodo({ title, dueDate, category: key })}
          onToggle={toggleTodo}
          onEdit={setEditingTodo}
          onRemove={removeTodo}
        />
      ))}

      {editingTodo && (
        <TodoEditModal
          todo={editingTodo}
          onSave={(id, changes) => updateTodo(id, changes)}
          onDelete={removeTodo}
          onClose={() => setEditingTodo(null)}
        />
      )}
    </main>
  );
}

function CategorySection({
  label,
  loaded,
  todos,
  onAdd,
  onToggle,
  onEdit,
  onRemove,
}: {
  label: string;
  loaded: boolean;
  todos: Todo[];
  onAdd: (title: string, dueDate?: string) => void;
  onToggle: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onRemove: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), dueDate || undefined);
    setTitle("");
    setDueDate("");
  }

  return (
    <section className="rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
      <h2 className="text-sm font-semibold">{label}</h2>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`New ${label.toLowerCase()} todo`}
            required
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] dark:border-white/[.145] dark:focus:border-white/[.4]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] dark:border-white/[.145] dark:focus:border-white/[.4]"
          />
        </label>
        <button
          type="submit"
          className="h-9 shrink-0 rounded-md bg-foreground px-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Add
        </button>
      </form>

      <div className="mt-3">
        {!loaded ? null : todos.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing here yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-black/[.02] dark:hover:bg-white/[.03]"
              >
                <label className="flex flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => onToggle(todo.id)}
                    className="h-4 w-4"
                  />
                  <button
                    type="button"
                    onClick={() => onEdit(todo)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${resolveColor(todo.id, todo.category).dot}`}
                      />
                      <p
                        className={
                          todo.done
                            ? "text-sm font-medium line-through text-zinc-400"
                            : "text-sm font-medium"
                        }
                      >
                        {todo.title}
                      </p>
                    </div>
                    {todo.dueDate && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Due {formatEventDate(todo.dueDate)}
                      </p>
                    )}
                  </button>
                </label>
                <button
                  onClick={() => onRemove(todo.id)}
                  className="text-sm text-zinc-400 transition-colors hover:text-red-500"
                  aria-label={`Remove ${todo.title}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
