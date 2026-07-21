"use client";

import { DragEvent, FormEvent, useState } from "react";
import { useScheduleEvents } from "@/hooks/useScheduleEvents";
import { useTodos } from "@/hooks/useTodos";
import { formatEventDate, formatEventTime, todayISODate, ScheduleEvent } from "@/lib/schedule";
import QuickAdd from "@/components/QuickAdd";
import EventEditModal from "@/components/EventEditModal";
import CategoryBadge from "@/components/CategoryBadge";
import { TODO_DRAG_TYPE, EVENT_DRAG_TYPE } from "@/lib/dnd";
import { resolveColor } from "@/lib/itemColor";

const fieldClass =
  "rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] dark:border-white/[.145] dark:focus:border-white/[.4]";

export default function SchedulePage() {
  const { events, loaded, addEvent, removeEvent, updateEvent } = useScheduleEvents();
  const { todos, toggleTodo, removeTodo } = useTodos();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [dragOverList, setDragOverList] = useState(false);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);

  const openTodos = todos.filter((todo) => !todo.done);

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
    removeEvent(eventId);
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
          className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-5 dark:border-white/[.145] sm:flex-row sm:items-end"
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
            className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
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
                  className={`flex cursor-pointer items-center justify-between rounded-lg border border-black/[.08] px-4 py-3 transition-colors hover:bg-black/[.02] dark:border-white/[.145] dark:hover:bg-white/[.03] ${
                    draggingEventId === event.id ? "opacity-40" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          resolveColor(event.todoId ?? event.id, event.category).dot
                        }`}
                      />
                      <p className="truncate font-medium">{event.title}</p>
                      {event.category && <CategoryBadge category={event.category} />}
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {formatEventDate(event.date)}
                      {event.time ? ` · ${formatEventTime(event.time)}` : ""}
                      {event.time && event.endTime ? ` – ${formatEventTime(event.endTime)}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeEvent(event.id);
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
          className={`rounded-xl border p-5 transition-colors ${
            dragOverTrash
              ? "border-red-500 bg-red-500/5"
              : "border-black/[.08] dark:border-white/[.145]"
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
                  className="flex cursor-grab items-start gap-2 rounded-md border border-black/[.12] px-3 py-2 text-sm active:cursor-grabbing dark:border-white/[.145]"
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
                          resolveColor(todo.id, todo.category).dot
                        }`}
                      />
                      <p
                        className={
                          todo.done ? "truncate font-medium line-through text-zinc-400" : "truncate font-medium"
                        }
                      >
                        {todo.title}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {todo.dueDate && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          Due {formatEventDate(todo.dueDate)}
                        </span>
                      )}
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
          onDelete={removeEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </main>
  );
}
