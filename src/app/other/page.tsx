"use client";

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import { useTodos } from "@/hooks/useTodos";
import { useCategoryColors } from "@/hooks/useCategoryColors";
import { useCategoryLabels } from "@/hooks/useCategoryLabels";
import { useCategoryOrder } from "@/hooks/useCategoryOrder";
import { Todo } from "@/lib/todos";
import { Category, isCategory } from "@/lib/categories";
import TodoEditModal from "@/components/TodoEditModal";
import TodoMeta from "@/components/TodoMeta";
import ColorSwatchPicker from "@/components/ColorSwatchPicker";
import { DEFAULT_CATEGORY_COLOR_KEY, resolveColor } from "@/lib/itemColor";
import { CATEGORY_DRAG_TYPE } from "@/lib/dnd";
import { applyBackup, downloadBackup, importLocalStorageBackup, isBackupData } from "@/lib/backup";
import CanvasSyncPanel from "@/components/CanvasSyncPanel";

const fieldClass =
  "rounded-[10px] border border-black/[.06] bg-black/[.025] px-3 py-2 text-sm outline-none transition-colors focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 dark:border-white/[.08] dark:bg-white/[.05] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]/20";

export default function OtherPage() {
  const { todos, loaded: todosLoaded, addTodo, toggleTodo, updateTodo, removeTodo } = useTodos();
  const { overrides: categoryColors, setCategoryColor } = useCategoryColors();
  const { labelFor, setCategoryLabel } = useCategoryLabels();
  const { order, moveCategory } = useCategoryOrder();

  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [draggingCategory, setDraggingCategory] = useState<Category | null>(null);
  const [editingLabel, setEditingLabel] = useState<Category | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!isBackupData(parsed)) {
          window.alert("That file doesn't look like a stits backup.");
          return;
        }
        if (
          window.confirm(
            "Importing will replace all current todos and events with the contents of this backup. Continue?"
          )
        ) {
          applyBackup(parsed);
        }
      } catch {
        window.alert("Couldn't read that file as JSON.");
      }
    };
    reader.readAsText(file);
  }

  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tag, setTag] = useState<Category>(order[0]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    addTodo({ title: content.trim(), dueDate: dueDate || undefined, category: tag });
    setContent("");
    setDueDate("");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Other</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Rush, career, school, house management, and everything else — todos.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-lg bg-white p-5 shadow-[0_2px_16px_rgba(0,0,0,0.08)] dark:bg-[#1c1c1e] dark:shadow-none"
      >
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="New todo"
            required
            className={fieldClass}
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Tag
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value as Category)}
              className={fieldClass}
            >
              {order.map((key) => (
                <option key={key} value={key}>
                  {labelFor(key)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-1 flex-col gap-1 text-sm">
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={fieldClass}
            />
          </label>

          <button
            type="submit"
            className="h-10 shrink-0 rounded-lg bg-[#0071e3] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0077ed] active:bg-[#006edb]"
          >
            Add
          </button>
        </div>
      </form>

      {order.map((key) => (
        <section
          key={key}
          draggable
          onDragStart={(e: DragEvent) => {
            e.dataTransfer.setData(CATEGORY_DRAG_TYPE, key);
            e.dataTransfer.effectAllowed = "move";
            setDraggingCategory(key);
          }}
          onDragEnd={() => setDraggingCategory(null)}
          onDragOver={(e: DragEvent) => {
            if (!e.dataTransfer.types.includes(CATEGORY_DRAG_TYPE)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e: DragEvent) => {
            const draggedKey = e.dataTransfer.getData(CATEGORY_DRAG_TYPE);
            if (!draggedKey || !isCategory(draggedKey)) return;
            e.preventDefault();
            moveCategory(draggedKey, key);
          }}
          className={`cursor-grab rounded-xl bg-white p-5 shadow-[0_2px_16px_rgba(0,0,0,0.08)] transition-opacity active:cursor-grabbing dark:bg-[#1c1c1e] dark:shadow-none ${
            draggingCategory === key ? "opacity-40" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <ColorSwatchPicker
              value={categoryColors[key] ?? DEFAULT_CATEGORY_COLOR_KEY[key]}
              onChange={(colorKey) => setCategoryColor(key, colorKey)}
            />
            {editingLabel === key ? (
              <input
                autoFocus
                defaultValue={labelFor(key)}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => {
                  setCategoryLabel(key, e.target.value);
                  setEditingLabel(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingLabel(null);
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="rounded border border-black/[.2] bg-transparent px-1 text-sm font-semibold outline-none dark:border-white/[.3]"
              />
            ) : (
              <h2
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingLabel(key);
                }}
                className="cursor-text text-sm font-semibold hover:underline"
              >
                {labelFor(key)}
              </h2>
            )}
          </div>

          <div className="mt-3">
            {!todosLoaded ? null : (
              <ul className="flex flex-col gap-1">
                {todos
                  .filter((todo) => todo.category === key)
                  .map((todo) => (
                    <li
                      key={todo.id}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-black/[.02] dark:hover:bg-white/[.03]"
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
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                resolveColor(todo.id, todo.category, categoryColors).dot
                              }`}
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
                          <TodoMeta todo={todo} />
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

            {todosLoaded && todos.filter((t) => t.category === key).length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing here yet.</p>
            )}
          </div>
        </section>
      ))}

      <CanvasSyncPanel />

      <section className="rounded-xl bg-white p-5 shadow-[0_2px_16px_rgba(0,0,0,0.08)] dark:bg-[#1c1c1e] dark:shadow-none">
        <h2 className="text-sm font-semibold">Data</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Your data lives in the database now. Export a backup periodically so you don&apos;t lose it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadBackup}
            className="rounded-full border border-[#0071e3] px-4 py-1.5 text-sm font-medium text-[#0071e3] transition-colors hover:bg-[#0071e3]/[.06] dark:border-[#2997ff] dark:text-[#2997ff] dark:hover:bg-[#2997ff]/[.1]"
          >
            Export backup
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="rounded-full border border-[#0071e3] px-4 py-1.5 text-sm font-medium text-[#0071e3] transition-colors hover:bg-[#0071e3]/[.06] dark:border-[#2997ff] dark:text-[#2997ff] dark:hover:bg-[#2997ff]/[.1]"
          >
            Import backup
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Pull in any todos and events still sitting in this browser's local storage from before the database was set up?"
                )
              ) {
                importLocalStorageBackup();
              }
            }}
            className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-black/[.03] dark:border-white/[.145] dark:text-zinc-400 dark:hover:bg-white/[.06]"
          >
            Import this browser&apos;s local data
          </button>
        </div>
      </section>

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
