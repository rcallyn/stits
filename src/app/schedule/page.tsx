"use client";

import { DragEvent, FormEvent, useRef, useState } from "react";
import { useScheduleEvents } from "@/hooks/useScheduleEvents";
import { useTodos } from "@/hooks/useTodos";
import { useCategoryColors } from "@/hooks/useCategoryColors";
import { formatEventDate, formatEventTime, todayISODate, ScheduleEvent } from "@/lib/schedule";
import { Todo } from "@/lib/todos";
import QuickAdd from "@/components/QuickAdd";
import EventEditModal from "@/components/EventEditModal";
import TodoEditModal from "@/components/TodoEditModal";
import CategoryBadge from "@/components/CategoryBadge";
import TodoMeta from "@/components/TodoMeta";
import { TODO_DRAG_TYPE, EVENT_DRAG_TYPE } from "@/lib/dnd";
import { resolveColor } from "@/lib/itemColor";

const fieldClass =
  "rounded-[10px] border border-black/[.06] bg-black/[.025] px-3 py-2 text-sm outline-none transition-colors focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 dark:border-white/[.08] dark:bg-white/[.05] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]/20";

export default function SchedulePage() {
  const { events, loaded, addEvent, removeEvent, restoreEvent, updateEvent } = useScheduleEvents();
  const { todos, toggleTodo, updateTodo, removeTodo } = useTodos();
  const { overrides: categoryColors } = useCategoryColors();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [dragOverList, setDragOverList] = useState(false);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [removedEvent, setRemovedEvent] = useState<ScheduleEvent | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openTodos = todos.filter((todo) => !todo.done);

  function handleRemove(id: string) {
    const event = events.find((e) => e.id === id);
    if (!event) return;
    removeEvent(id);
    setRemovedEvent(event);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => setRemovedEvent(null), 6000);
  }

  function handleUndoRemove() {
    if (!removedEvent) return;
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    restoreEvent(removedEvent);
    setRemovedEvent(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    addEvent({
      title: title.trim(),
      date,
      time,
      endTime: time && endTime ? endTime : undefined,
    });
    setTitle("");
    setDate("");
    setTime("");
    setEndTime("");
  }

  function handleListDragOver(e: DragEvent) {
    if (!e.dataTransfer.types.includes(TODO_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverList(true);
  }

  function handleListDrop(e: DragEvent) {
    const todoId = e.dataTransfer.getData(TODO_DRAG_TYPE);
    setDragOverList(false);
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

  function handleTrashDragOver(e: DragEvent) {
    if (!e.dataTransfer.types.includes(EVENT_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTrash(true);
  }

  function handleTrashDrop(e: DragEvent) {
    const eventId = e.dataTransfer.getData(EVENT_DRAG_TYPE);
    setDragOverTrash(false);
    if (!eventId) return;
    e.preventDefault();
    handleRemove(eventId);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Your events will show up here. Drag a todo from the side panel to schedule it.
          </p>
        </div>

        <QuickAdd />

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-lg bg-white p-5 shadow-[0_2px_16px_rgba(0,0,0,0.08)] dark:bg-[#1c1c1e] dark:shadow-none sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Team standup"
              required
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Start
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            End
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={!time}
              className={`${fieldClass} disabled:opacity-40`}
            />
          </label>
          <button
            type="submit"
            className="h-10 rounded-lg bg-[#0071e3] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0077ed] active:bg-[#006edb]"
          >
            Add event
          </button>
        </form>

        <div
          onDragOver={handleListDragOver}
          onDragLeave={() => setDragOverList(false)}
          onDrop={handleListDrop}
          className={`rounded-lg transition-colors ${
            dragOverList ? "ring-2 ring-black/[.3] ring-offset-2 ring-offset-background dark:ring-white/[.4]" : ""
          }`}
        >
          {loaded && events.length === 0 && (
            <div className="rounded-lg border border-dashed border-black/[.12] p-8 text-center text-sm text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
              No schedule items yet. Drop a todo here, or add one above.
            </div>
          )}

          {events.length > 0 && (
            <ul className="flex flex-col gap-2">
              {events.map((event) => (
                <li
                  key={event.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(EVENT_DRAG_TYPE, event.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingEventId(event.id);
                  }}
                  onDragEnd={() => {
                    setDraggingEventId(null);
                    setDragOverTrash(false);
                  }}
                  onClick={() => setEditingEvent(event)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg bg-black/[.02] px-4 py-3 transition-colors hover:bg-black/[.04] dark:bg-white/[.04] dark:hover:bg-white/[.07] ${
                    draggingEventId === event.id ? "opacity-40" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          resolveColor(event.todoId ?? event.id, event.category, categoryColors).dot
                        }`}
                      />
                      <p className="truncate font-medium">
                        {event.recurrence && <span title="Repeats">↻ </span>}
                        {event.title}
                      </p>
                      {event.category && <CategoryBadge category={event.category} />}
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {formatEventDate(event.date)}
                      {event.endDate && event.endDate > event.date
                        ? ` – ${formatEventDate(event.endDate)}`
                        : ""}
                      {event.time ? ` · ${formatEventTime(event.time)}` : ""}
                      {event.time && event.endTime ? ` – ${formatEventTime(event.endTime)}` : ""}
                      {event.recurrence &&
                        ` · Repeats ${event.recurrence.freq}${
                          event.recurrence.interval > 1 ? ` (every ${event.recurrence.interval})` : ""
                        }`}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(event.id);
                    }}
                    className="shrink-0 text-sm text-zinc-400 transition-colors hover:text-red-500"
                    aria-label={`Remove ${event.title}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="w-full shrink-0 lg:w-72">
        <div
          onDragOver={handleTrashDragOver}
          onDragLeave={() => setDragOverTrash(false)}
          onDrop={handleTrashDrop}
          className={`rounded-xl p-5 shadow-[0_2px_16px_rgba(0,0,0,0.08)] transition-colors dark:shadow-none ${
            dragOverTrash ? "bg-red-500/10 ring-2 ring-red-500" : "bg-white dark:bg-[#1c1c1e]"
          }`}
        >
          <h2 className="text-sm font-semibold">Unscheduled todos</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {draggingEventId
              ? "Drop here to remove from the schedule."
              : "Drag a todo onto the schedule to add it."}
          </p>

          {openTodos.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">No open todos.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {openTodos.map((todo) => (
                <li
                  key={todo.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TODO_DRAG_TYPE, todo.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="flex cursor-grab items-start gap-2 rounded-md bg-black/[.03] px-3 py-2 text-sm active:cursor-grabbing dark:bg-white/[.05]"
                >
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => toggleTodo(todo.id)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          resolveColor(todo.id, todo.category, categoryColors).dot
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setEditingTodo(todo)}
                        className={
                          todo.done
                            ? "truncate text-left font-medium line-through text-zinc-400"
                            : "truncate text-left font-medium"
                        }
                      >
                        {todo.title}
                      </button>
                    </div>
                    <TodoMeta todo={todo} />
                    <div className="mt-1 flex items-center gap-2">
                      {todo.category && <CategoryBadge category={todo.category} />}
                    </div>
                  </div>
                  <button
                    onClick={() => removeTodo(todo.id)}
                    className="shrink-0 text-xs text-zinc-400 transition-colors hover:text-red-500"
                    aria-label={`Delete ${todo.title}`}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {editingEvent && (
        <EventEditModal
          event={editingEvent}
          onSave={(id, changes) => updateEvent(id, changes)}
          onDelete={handleRemove}
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

      {removedEvent && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="flex items-center gap-4 rounded-full bg-foreground px-5 py-3 text-sm text-background shadow-lg">
            <span className="max-w-[16rem] truncate">Removed &ldquo;{removedEvent.title}&rdquo;</span>
            <button
              type="button"
              onClick={handleUndoRemove}
              className="shrink-0 font-semibold text-[#0071e3] transition-opacity hover:opacity-80"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
