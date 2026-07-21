"use client";

import { DragEvent, useState } from "react";
import Link from "next/link";
import { useScheduleEvents } from "@/hooks/useScheduleEvents";
import { ScheduleEvent, todayISODate } from "@/lib/schedule";
import { Todo } from "@/lib/todos";
import DayCalendar from "@/components/DayCalendar";
import { useTodos } from "@/hooks/useTodos";
import { useNotes } from "@/hooks/useNotes";
import QuickAdd from "@/components/QuickAdd";
import EventEditModal from "@/components/EventEditModal";
import TodoEditModal from "@/components/TodoEditModal";
import CategoryBadge from "@/components/CategoryBadge";
import { formatNoteTimestamp } from "@/lib/notes";
import { TODO_DRAG_TYPE } from "@/lib/dnd";
import { resolveColor } from "@/lib/itemColor";

export default function Home() {
  const { events, loaded: eventsLoaded, addEvent, updateEvent, removeEvent } = useScheduleEvents();
  const { todos, loaded: todosLoaded, toggleTodo, updateTodo, removeTodo } = useTodos();
  const { notes, loaded: notesLoaded } = useNotes();

  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [dragOverToday, setDragOverToday] = useState(false);

  const todayEvents = events.filter((event) => event.date === todayISODate());
  const openTodos = todos.filter((todo) => !todo.done);

  function handleTodayDragOver(e: DragEvent) {
    if (!e.dataTransfer.types.includes(TODO_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverToday(true);
  }

  function handleTodayDrop(e: DragEvent) {
    const todoId = e.dataTransfer.getData(TODO_DRAG_TYPE);
    setDragOverToday(false);
    if (!todoId) return;
    e.preventDefault();
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;
    addEvent({
      title: todo.title,
      date: todayISODate(),
      time: "",
      todoId: todo.id,
      category: todo.category,
    });
  }

  function handleDropOnTimeSlot(dataTransfer: DataTransfer, time: string) {
    const todoId = dataTransfer.getData(TODO_DRAG_TYPE);
    if (!todoId) return;
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;
    addEvent({
      title: todo.title,
      date: todayISODate(),
      time,
      todoId: todo.id,
      category: todo.category,
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            A quick overview of your day.
          </p>
        </div>

        <QuickAdd />

        <section className="rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Today</h2>
            <Link
              href="/schedule"
              className="text-sm text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
            >
              Full schedule →
            </Link>
          </div>

          <div
            onDragOver={handleTodayDragOver}
            onDragLeave={() => setDragOverToday(false)}
            onDrop={handleTodayDrop}
            className={`mt-4 rounded-lg transition-colors ${
              dragOverToday ? "ring-2 ring-black/[.3] ring-offset-2 ring-offset-background dark:ring-white/[.4]" : ""
            }`}
          >
            {!eventsLoaded ? null : todayEvents.length === 0 ? (
              <p className="flex h-32 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
                {dragOverToday ? "Drop to schedule for today" : "Nothing planned for today."}
              </p>
            ) : (
              <DayCalendar
                events={todayEvents}
                onUpdateEvent={updateEvent}
                onEditEvent={setEditingEvent}
                onDropExternal={handleDropOnTimeSlot}
              />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Todos</h2>
            <Link
              href="/todos"
              className="text-sm text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
            >
              All todos →
            </Link>
          </div>

          <div className="mt-4">
            {!todosLoaded ? null : openTodos.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No todos yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {openTodos.map((todo) => (
                  <li
                    key={todo.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(TODO_DRAG_TYPE, todo.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="flex cursor-grab items-center gap-3 rounded-md px-2 py-1.5 hover:bg-black/[.02] active:cursor-grabbing dark:hover:bg-white/[.03]"
                  >
                    <input
                      type="checkbox"
                      checked={todo.done}
                      onChange={() => toggleTodo(todo.id)}
                      className="h-4 w-4 shrink-0"
                    />
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${resolveColor(todo.id, todo.category).dot}`}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingTodo(todo)}
                      className="flex-1 truncate text-left text-sm font-medium"
                    >
                      {todo.title}
                    </button>
                    {todo.category && <CategoryBadge category={todo.category} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <aside className="w-full shrink-0 lg:w-72">
        <details className="rounded-xl border border-black/[.08] dark:border-white/[.145]">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold">
            Notes
            <span className="text-zinc-400">⌄</span>
          </summary>
          <div className="border-t border-black/[.08] px-5 py-4 dark:border-white/[.145]">
            {!notesLoaded ? null : notes.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No notes yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {notes.slice(0, 6).map((note) => (
                  <li key={note.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      {note.tag === "other" ? (
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          {note.otherTitle || "Other"}
                        </span>
                      ) : (
                        <CategoryBadge category={note.tag} />
                      )}
                      <span className="text-[11px] text-zinc-400">
                        {formatNoteTimestamp(note.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm">{note.text}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/notes"
              className="mt-4 inline-block text-sm text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
            >
              All notes →
            </Link>
          </div>
        </details>
      </aside>

      {editingEvent && (
        <EventEditModal
          event={editingEvent}
          onSave={(id, changes) => updateEvent(id, changes)}
          onDelete={removeEvent}
          onClose={() => setEditingEvent(null)}
        />
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
