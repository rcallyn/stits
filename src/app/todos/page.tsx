"use client";

import { FormEvent, useState } from "react";
import { useTodos } from "@/hooks/useTodos";
import { formatEventDate } from "@/lib/schedule";
import { Todo } from "@/lib/todos";
import TodoEditModal from "@/components/TodoEditModal";
import { resolveColor } from "@/lib/itemColor";

export default function TodosPage() {
  const { todos, loaded, addTodo, toggleTodo, updateTodo, removeTodo } = useTodos();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addTodo({ title: title.trim(), dueDate: dueDate || undefined });
    setTitle("");
    setDueDate("");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Todos</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Your tasks will show up here.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-5 dark:border-white/[.145] sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Renew passport"
            required
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] dark:border-white/[.145] dark:focus:border-white/[.4]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
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
          className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Add todo
        </button>
      </form>

      {loaded && todos.length === 0 && (
        <div className="rounded-lg border border-dashed border-black/[.12] p-8 text-center text-sm text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
          No todos yet.
        </div>
      )}

      {todos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className="flex items-center justify-between rounded-lg border border-black/[.08] px-4 py-3 dark:border-white/[.145]"
            >
              <label className="flex flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggleTodo(todo.id)}
                  className="h-4 w-4"
                />
                <button
                  type="button"
                  onClick={() => setEditingTodo(todo)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${resolveColor(todo.id, todo.category).dot}`}
                    />
                    <p
                      className={
                        todo.done
                          ? "font-medium line-through text-zinc-400"
                          : "font-medium"
                      }
                    >
                      {todo.title}
                    </p>
                  </div>
                  {todo.dueDate && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Due {formatEventDate(todo.dueDate)}
                    </p>
                  )}
                </button>
              </label>
              <button
                onClick={() => removeTodo(todo.id)}
                className="text-sm text-zinc-400 transition-colors hover:text-red-500"
                aria-label={`Remove ${todo.title}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

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
