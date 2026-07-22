"use client";

import { DragEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTodos } from "@/hooks/useTodos";
import { useNotes } from "@/hooks/useNotes";
import { usePendingNoteId } from "@/hooks/usePendingNote";
import { useCategoryColors } from "@/hooks/useCategoryColors";
import { useCategoryLabels } from "@/hooks/useCategoryLabels";
import { useCategoryOrder } from "@/hooks/useCategoryOrder";
import { formatEventDate } from "@/lib/schedule";
import { formatNoteTimestamp, Note } from "@/lib/notes";
import { Todo } from "@/lib/todos";
import { Category, CATEGORY_LIST, isCategory } from "@/lib/categories";
import TodoEditModal from "@/components/TodoEditModal";
import ColorSwatchPicker from "@/components/ColorSwatchPicker";
import { DEFAULT_CATEGORY_COLOR_KEY, resolveColor } from "@/lib/itemColor";
import { CATEGORY_DRAG_TYPE } from "@/lib/dnd";

const fieldClass =
  "rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] dark:border-white/[.145] dark:focus:border-white/[.4]";

type Kind = "todo" | "note";

export default function OtherPage() {
  const { todos, loaded: todosLoaded, addTodo, toggleTodo, updateTodo, removeTodo } = useTodos();
  const { notes, loaded: notesLoaded, addNote, removeNote } = useNotes();
  const { setPendingNoteId } = usePendingNoteId();
  const { overrides: categoryColors, setCategoryColor } = useCategoryColors();
  const { labelFor, setCategoryLabel } = useCategoryLabels();
  const { order, moveCategory } = useCategoryOrder();
  const router = useRouter();

  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [draggingCategory, setDraggingCategory] = useState<Category | null>(null);
  const [editingLabel, setEditingLabel] = useState<Category | null>(null);

  const [kind, setKind] = useState<Kind>("todo");
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tag, setTag] = useState<Category>(CATEGORY_LIST[0][0]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    if (kind === "todo") {
      addTodo({ title: content.trim(), dueDate: dueDate || undefined, category: tag });
    } else {
      addNote({ text: content.trim(), tag });
    }
    setContent("");
    setDueDate("");
  }

  function handleAddToSchedule(note: Note) {
    setPendingNoteId(note.id);
    router.push("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Other</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Rush, career, school, and house management — todos and notes.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]"
      >
        <div className="flex gap-2">
          {(["todo", "note"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                kind === k
                  ? "bg-foreground text-background"
                  : "border border-black/[.12] text-zinc-500 hover:text-foreground dark:border-white/[.145] dark:text-zinc-400"
              }`}
            >
              {k === "todo" ? "Todo" : "Note"}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          {kind === "todo" ? "Title" : "Note"}
          {kind === "todo" ? (
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="New todo"
              required
              className={fieldClass}
            />
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              required
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          )}
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

          {kind === "todo" && (
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={fieldClass}
              />
            </label>
          )}

          <button
            type="submit"
            className="h-10 shrink-0 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
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
          className={`cursor-grab rounded-xl border border-black/[.08] p-5 transition-opacity active:cursor-grabbing dark:border-white/[.145] ${
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
                          {todo.dueDate && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
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

            {!notesLoaded ? null : (
              <ul className="mt-2 flex flex-col gap-2">
                {notes
                  .filter((note) => note.tag === key)
                  .map((note) => (
                    <li
                      key={note.id}
                      className="flex flex-col gap-2 rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm">{note.text}</p>
                        <button
                          onClick={() => removeNote(note.id)}
                          className="shrink-0 text-xs text-zinc-400 transition-colors hover:text-red-500"
                          aria-label="Delete note"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">
                          {formatNoteTimestamp(note.createdAt)}
                        </span>
                        <button
                          onClick={() => handleAddToSchedule(note)}
                          className="text-xs font-medium text-zinc-500 underline-offset-2 transition-colors hover:text-foreground hover:underline dark:text-zinc-400"
                        >
                          Add to schedule →
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            )}

            {todosLoaded &&
              notesLoaded &&
              todos.filter((t) => t.category === key).length === 0 &&
              notes.filter((n) => n.tag === key).length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing here yet.</p>
              )}
          </div>
        </section>
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
