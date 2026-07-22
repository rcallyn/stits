"use client";

import { DragEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useScheduleEvents } from "@/hooks/useScheduleEvents";
import { ScheduleEvent, formatEventDate, shiftISODate, todayISODate, truncateForTitle } from "@/lib/schedule";
import { Todo } from "@/lib/todos";
import DayCalendar from "@/components/DayCalendar";
import { useTodos } from "@/hooks/useTodos";
import { useNotes } from "@/hooks/useNotes";
import { usePendingNoteId } from "@/hooks/usePendingNote";
import { useCategoryColors } from "@/hooks/useCategoryColors";
import QuickAdd from "@/components/QuickAdd";
import EventEditModal from "@/components/EventEditModal";
import TodoEditModal from "@/components/TodoEditModal";
import CategoryBadge from "@/components/CategoryBadge";
import { formatNoteTimestamp } from "@/lib/notes";
import { NOTE_DRAG_TYPE, TODO_DRAG_TYPE } from "@/lib/dnd";
import { resolveColor } from "@/lib/itemColor";

export default function Home() {
  const { events, loaded: eventsLoaded, addEvent, updateEvent, removeEvent } = useScheduleEvents();
  const { todos, loaded: todosLoaded, toggleTodo, updateTodo, removeTodo } = useTodos();
  const { notes, loaded: notesLoaded, updateNote } = useNotes();
  const { pendingNoteId, setPendingNoteId } = usePendingNoteId();
  const { overrides: categoryColors } = useCategoryColors();

  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [dragOverToday, setDragOverToday] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayISODate());

  const isToday = selectedDate === todayISODate();
  const visibleEvents = events.filter((event) => event.date === selectedDate);
  const openTodos = todos.filter((todo) => !todo.done);
  const pendingNote = notes.find((n) => n.id === pendingNoteId) ?? null;

  useEffect(() => {
    if (!pendingNote) return;
    function handleMove(e: MouseEvent) {
      setCursorPos({ x: e.clientX, y: e.clientY });
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPendingNoteId(null);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("keydown", handleKey);
    };
  }, [pendingNote, setPendingNoteId]);

  function handleTodayDragOver(e: DragEvent) {
    if (
      !e.dataTransfer.types.includes(TODO_DRAG_TYPE) &&
      !e.dataTransfer.types.includes(NOTE_DRAG_TYPE)
    )
      return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverToday(true);
  }

  function handleTodayDrop(e: DragEvent) {
    setDragOverToday(false);
    const todoId = e.dataTransfer.getData(TODO_DRAG_TYPE);
    if (todoId) {
      e.preventDefault();
      const todo = todos.find((t) => t.id === todoId);
      if (!todo) return;
      addEvent({
        title: todo.title,
        date: selectedDate,
        time: "",
        todoId: todo.id,
        category: todo.category,
      });
      return;
    }
    const noteId = e.dataTransfer.getData(NOTE_DRAG_TYPE);
    if (noteId) {
      e.preventDefault();
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      addEvent({
        title: truncateForTitle(note.text),
        date: selectedDate,
        time: "",
        category: note.tag,
        notes: [{ id: crypto.randomUUID(), text: note.text, sourceNoteId: note.id }],
        isNoteEvent: true,
      });
    }
  }

  function handleDropOnTimeSlot(dataTransfer: DataTransfer, time: string) {
    const todoId = dataTransfer.getData(TODO_DRAG_TYPE);
    if (todoId) {
      const todo = todos.find((t) => t.id === todoId);
      if (!todo) return;
      addEvent({
        title: todo.title,
        date: selectedDate,
        time,
        todoId: todo.id,
        category: todo.category,
      });
      return;
    }
    const noteId = dataTransfer.getData(NOTE_DRAG_TYPE);
    if (noteId) {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      addEvent({
        title: truncateForTitle(note.text),
        date: selectedDate,
        time,
        category: note.tag,
        notes: [{ id: crypto.randomUUID(), text: note.text, sourceNoteId: note.id }],
        isNoteEvent: true,
      });
    }
  }

  function handleDropNoteOnEvent(event: ScheduleEvent, noteId: string) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    updateEvent(event.id, {
      notes: [...(event.notes ?? []), { id: crypto.randomUUID(), text: note.text, sourceNoteId: note.id }],
    });
  }

  function isEventDone(event: ScheduleEvent) {
    if (event.todoId) return todos.find((t) => t.id === event.todoId)?.done ?? false;
    return Boolean(event.done);
  }

  function handleToggleDone(event: ScheduleEvent) {
    if (event.todoId) {
      toggleTodo(event.todoId);
    } else {
      updateEvent(event.id, { done: !event.done });
    }
  }

  function handlePlaceAtTime(time: string) {
    if (!pendingNote) return;
    addEvent({
      title: truncateForTitle(pendingNote.text),
      date: selectedDate,
      time,
      category: pendingNote.tag,
      notes: [{ id: crypto.randomUUID(), text: pendingNote.text, sourceNoteId: pendingNote.id }],
      isNoteEvent: true,
    });
    setPendingNoteId(null);
  }

  function handlePlaceAllDay() {
    if (!pendingNote) return;
    addEvent({
      title: truncateForTitle(pendingNote.text),
      date: selectedDate,
      time: "",
      category: pendingNote.tag,
      notes: [{ id: crypto.randomUUID(), text: pendingNote.text, sourceNoteId: pendingNote.id }],
      isNoteEvent: true,
    });
    setPendingNoteId(null);
  }

  function handlePlaceOnEvent(event: ScheduleEvent) {
    if (!pendingNote) return;
    updateEvent(event.id, {
      notes: [
        ...(event.notes ?? []),
        { id: crypto.randomUUID(), text: pendingNote.text, sourceNoteId: pendingNote.id },
      ],
    });
    setPendingNoteId(null);
  }

  function handleAddNoteLine(event: ScheduleEvent, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    updateEvent(event.id, { notes: [...(event.notes ?? []), { id: crypto.randomUUID(), text: trimmed }] });
  }

  function handleEditNoteLine(event: ScheduleEvent, lineId: string, text: string) {
    const trimmed = text.trim();
    const existing = event.notes ?? [];
    const target = existing.find((note) => note.id === lineId);

    if (!trimmed) {
      updateEvent(event.id, { notes: existing.filter((note) => note.id !== lineId) });
      return;
    }

    updateEvent(event.id, {
      notes: existing.map((note) => (note.id === lineId ? { ...note, text: trimmed } : note)),
    });

    // Keep every other copy of this note (the source Note, and any other
    // event it's attached to) in sync with the edit.
    if (target?.sourceNoteId) {
      updateNote(target.sourceNoteId, { text: trimmed });
      for (const other of events) {
        if (other.id === event.id) continue;
        if (!other.notes?.some((note) => note.sourceNoteId === target.sourceNoteId)) continue;
        updateEvent(other.id, {
          notes: other.notes.map((note) =>
            note.sourceNoteId === target.sourceNoteId ? { ...note, text: trimmed } : note
          ),
        });
      }
    }
  }

  function handleRemoveNoteLine(eventId: string, lineId: string) {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    updateEvent(eventId, { notes: (event.notes ?? []).filter((note) => note.id !== lineId) });
  }

  function handleMergeNoteEvent(source: ScheduleEvent, target: ScheduleEvent) {
    updateEvent(target.id, { notes: [...(target.notes ?? []), ...(source.notes ?? [])] });
    removeEvent(source.id);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-12">
      {pendingNote && (
        <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-3 border-b border-black/[.08] bg-background/95 px-4 py-2 text-center text-sm backdrop-blur dark:border-white/[.145]">
          <span>
            📝 Placing note: <strong>{truncateForTitle(pendingNote.text, 60)}</strong> — click a
            time slot or an event on Today
          </span>
          <button
            type="button"
            onClick={() => setPendingNoteId(null)}
            className="shrink-0 text-zinc-500 underline transition-colors hover:text-foreground dark:text-zinc-400"
          >
            Cancel
          </button>
        </div>
      )}
      {pendingNote && cursorPos && (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-md border border-black/[.12] bg-background px-3 py-2 text-xs shadow-lg dark:border-white/[.145]"
          style={{ left: cursorPos.x + 14, top: cursorPos.y + 14 }}
        >
          📝 {truncateForTitle(pendingNote.text, 60)}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">A quick overview of your day.</p>
      </div>

      <QuickAdd />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <section className="flex-1 rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{isToday ? "Today" : formatEventDate(selectedDate)}</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedDate(shiftISODate(selectedDate, -1))}
                aria-label="Previous day"
                className="rounded-md px-1.5 py-0.5 text-sm text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
              >
                ←
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="rounded-md border border-black/[.12] bg-transparent px-2 py-1 text-sm outline-none dark:border-white/[.145]"
              />
              <button
                type="button"
                onClick={() => setSelectedDate(shiftISODate(selectedDate, 1))}
                aria-label="Next day"
                className="rounded-md px-1.5 py-0.5 text-sm text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
              >
                →
              </button>
              {!isToday && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayISODate())}
                  className="text-xs text-zinc-500 underline-offset-2 transition-colors hover:text-foreground hover:underline dark:text-zinc-400"
                >
                  Today
                </button>
              )}
            </div>
            <Link
              href="/schedule"
              className="text-sm text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
            >
              Full schedule →
            </Link>
          </div>
        </div>

        <div
          onDragOver={handleTodayDragOver}
          onDragLeave={() => setDragOverToday(false)}
          onDrop={handleTodayDrop}
          className={`mt-4 rounded-lg transition-colors ${
            dragOverToday ? "ring-2 ring-black/[.3] ring-offset-2 ring-offset-background dark:ring-white/[.4]" : ""
          }`}
        >
          {!eventsLoaded ? null : visibleEvents.length === 0 ? (
            <p
              onClick={() => pendingNote && handlePlaceAllDay()}
              className={`flex h-32 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400 ${
                pendingNote ? "cursor-crosshair" : ""
              }`}
            >
              {dragOverToday
                ? "Drop to schedule for this day"
                : pendingNote
                  ? "Click here to attach the note (all day)"
                  : "Nothing planned for this day."}
            </p>
          ) : (
            <DayCalendar
              events={visibleEvents}
              onUpdateEvent={updateEvent}
              onEditEvent={setEditingEvent}
              onDropExternal={handleDropOnTimeSlot}
              isEventDone={isEventDone}
              onToggleDone={handleToggleDone}
              onDeleteEvent={(event) => removeEvent(event.id)}
              placementActive={Boolean(pendingNote)}
              onPlaceAtTime={handlePlaceAtTime}
              onPlaceAllDay={handlePlaceAllDay}
              onPlaceOnEvent={handlePlaceOnEvent}
              onAddNoteLine={handleAddNoteLine}
              onEditNoteLine={handleEditNoteLine}
              onRemoveNoteLine={(event, lineId) => handleRemoveNoteLine(event.id, lineId)}
              onMergeNoteEvent={handleMergeNoteEvent}
              onDropNoteOnEvent={handleDropNoteOnEvent}
              categoryColors={categoryColors}
            />
          )}
        </div>
      </section>

      <div className="flex w-full flex-col gap-6 lg:w-80 lg:shrink-0">
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
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      resolveColor(todo.id, todo.category, categoryColors).dot
                    }`}
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

      <section className="rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Notes</h2>
          <Link
            href="/other"
            className="text-sm text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
          >
            Manage notes →
          </Link>
        </div>

        <div className="mt-4">
          {!notesLoaded ? null : notes.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No notes yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {notes.slice(0, 6).map((note) => (
                <li
                  key={note.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(NOTE_DRAG_TYPE, note.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="cursor-grab rounded-md px-2 py-1.5 hover:bg-black/[.02] active:cursor-grabbing dark:hover:bg-white/[.03]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <CategoryBadge category={note.tag} />
                    <span className="text-[11px] text-zinc-400">
                      {formatNoteTimestamp(note.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm">{note.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      </div>
      </div>

      {editingEvent && (
        <EventEditModal
          event={editingEvent}
          onSave={(id, changes) => updateEvent(id, changes)}
          onDelete={removeEvent}
          onClose={() => setEditingEvent(null)}
          onRemoveNoteLine={handleRemoveNoteLine}
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
