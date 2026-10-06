"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useScheduleEvents } from "@/hooks/useScheduleEvents";
import {
  baseEventId,
  expandRecurringEvents,
  formatEventDate,
  isEventOnDate,
  minutesToTime,
  ScheduleEvent,
  shiftISODate,
  todayISODate,
} from "@/lib/schedule";
import { isOverdue, PRIORITY_META, subtaskProgress, Todo } from "@/lib/todos";
import DayCalendar from "@/components/DayCalendar";
import { useTodos } from "@/hooks/useTodos";
import { useJumpToDate } from "@/hooks/useJumpToDate";
import { useCategoryColors } from "@/hooks/useCategoryColors";
import { DropZone, startTodoDrag, useTodoDropHandler } from "@/hooks/useTodoDrag";
import QuickAdd from "@/components/QuickAdd";
import EventEditModal from "@/components/EventEditModal";
import TodoEditModal from "@/components/TodoEditModal";
import CategoryBadge from "@/components/CategoryBadge";
import IOSDatePicker from "@/components/IOSDatePicker";
import StatsWidget from "@/components/StatsWidget";
import WeekCalendar from "@/components/WeekCalendar";
import { ListSkeleton, SkeletonLine } from "@/components/Skeleton";
import { resolveColor } from "@/lib/itemColor";
import { weekDates } from "@/lib/monthGrid";

function formatWeekRangeLabel(start: string, end: string) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const startLabel = new Date(sy, sm - 1, sd).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endLabel = new Date(ey, em - 1, ed).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

export default function Home() {
  const { events, loaded: eventsLoaded, addEvent, updateEvent, removeEvent } = useScheduleEvents();
  const { todos, loaded: todosLoaded, toggleTodo, updateTodo, removeTodo } = useTodos();
  const { jumpToDate, setJumpToDate } = useJumpToDate();
  const { overrides: categoryColors } = useCategoryColors();

  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayISODate());
  const [lastAppliedJump, setLastAppliedJump] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"day" | "week">("week");

  if (jumpToDate && jumpToDate !== lastAppliedJump) {
    setLastAppliedJump(jumpToDate);
    setSelectedDate(jumpToDate);
  }

  const isToday = selectedDate === todayISODate();
  const visibleEvents = expandRecurringEvents(events, selectedDate, selectedDate).filter((event) =>
    isEventOnDate(event, selectedDate)
  );
  const weekDays = weekDates(selectedDate);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[weekDays.length - 1];
  const showTodayShortcut = viewMode === "week" ? !weekDays.includes(todayISODate()) : !isToday;
  // School assignments are usually numerous and often auto-imported (Canvas
  // sync) — only show ones due in the visible week so they don't drown out
  // everything else. Other categories still show all open todos.
  const openTodos = todos.filter((todo) => {
    if (todo.done) return false;
    if (todo.category === "school") {
      return Boolean(todo.dueDate && todo.dueDate >= weekStart && todo.dueDate <= weekEnd);
    }
    return true;
  });

  useEffect(() => {
    if (jumpToDate) setJumpToDate(null);
  }, [jumpToDate, setJumpToDate]);

  // Dragging a todo onto the calendar (WeekCalendar's day columns/headers,
  // DayCalendar's grid/all-day row) reaches here through one shared handler —
  // see useTodoDrag.ts for how the drop zone is identified.
  const handleTodoDrop = useCallback(
    (todo: Todo, zone: DropZone) => {
      addEvent({
        title: todo.title,
        date: zone.date,
        time: zone.kind === "timed" ? minutesToTime(zone.minutes) : "",
        todoId: todo.id,
        category: todo.category,
      });
    },
    [addEvent]
  );
  useTodoDropHandler(handleTodoDrop);

  // Keyboard/click-accessible equivalent of dragging a todo onto the
  // calendar: schedule it (all-day) for the currently selected date.
  function scheduleTodoForSelectedDate(todo: Todo) {
    addEvent({
      title: todo.title,
      date: selectedDate,
      time: "",
      todoId: todo.id,
      category: todo.category,
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

  function handleAddNoteLine(event: ScheduleEvent, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    updateEvent(event.id, { notes: [...(event.notes ?? []), { id: crypto.randomUUID(), text: trimmed }] });
  }

  function handleEditNoteLine(event: ScheduleEvent, lineId: string, text: string) {
    const trimmed = text.trim();
    const existing = event.notes ?? [];

    if (!trimmed) {
      updateEvent(event.id, { notes: existing.filter((note) => note.id !== lineId) });
      return;
    }

    updateEvent(event.id, {
      notes: existing.map((note) => (note.id === lineId ? { ...note, text: trimmed } : note)),
    });
  }

  function handleRemoveNoteLine(eventId: string, lineId: string) {
    const realId = baseEventId(eventId);
    const event = events.find((e) => e.id === realId);
    if (!event) return;
    updateEvent(realId, { notes: (event.notes ?? []).filter((note) => note.id !== lineId) });
  }

  function handleMergeNoteEvent(source: ScheduleEvent, target: ScheduleEvent) {
    updateEvent(target.id, { notes: [...(target.notes ?? []), ...(source.notes ?? [])] });
    removeEvent(source.id);
  }

  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <div className="w-full sm:w-96">
          <QuickAdd />
        </div>
      </div>

      <StatsWidget todos={todos} events={events} />

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col rounded-xl bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,0.08)] dark:bg-[#1c1c1e] dark:shadow-none lg:min-h-[75vh]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {viewMode === "week"
              ? formatWeekRangeLabel(weekDays[0], weekDays[weekDays.length - 1])
              : isToday
                ? "Today"
                : formatEventDate(selectedDate)}
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setSelectedDate(shiftISODate(selectedDate, viewMode === "week" ? -7 : -1))
                }
                aria-label={viewMode === "week" ? "Previous week" : "Previous day"}
                className="rounded-md px-1.5 py-0.5 text-sm text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
              >
                ←
              </button>
              <IOSDatePicker value={selectedDate} onChange={setSelectedDate} />
              <button
                type="button"
                onClick={() =>
                  setSelectedDate(shiftISODate(selectedDate, viewMode === "week" ? 7 : 1))
                }
                aria-label={viewMode === "week" ? "Next week" : "Next day"}
                className="rounded-md px-1.5 py-0.5 text-sm text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
              >
                →
              </button>
              {showTodayShortcut && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayISODate())}
                  className="text-xs text-zinc-500 underline-offset-2 transition-colors hover:text-foreground hover:underline dark:text-zinc-400"
                >
                  Today
                </button>
              )}
            </div>
            <div className="flex items-center gap-0.5 rounded-lg bg-black/[.05] p-0.5 text-xs dark:bg-white/[.08]">
              {(["week", "day"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-md px-2 py-1 font-medium capitalize transition-colors ${
                    viewMode === mode
                      ? "bg-white text-foreground shadow-sm dark:bg-[#3a3a3c]"
                      : "text-zinc-500 hover:text-foreground dark:text-zinc-400"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto rounded-lg">
          {!eventsLoaded ? (
            <SkeletonLine className="h-full min-h-[24rem] w-full" />
          ) : viewMode === "week" ? (
            <WeekCalendar
              selectedDate={selectedDate}
              events={events}
              categoryColors={categoryColors}
              isEventDone={isEventDone}
              onSelectDay={(dateStr) => {
                setSelectedDate(dateStr);
                setViewMode("day");
              }}
              onEditEvent={setEditingEvent}
            />
          ) : visibleEvents.length === 0 ? (
            <p
              data-drop-zone="allday"
              data-drop-date={selectedDate}
              className="flex h-32 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400"
            >
              Nothing planned for this day.
            </p>
          ) : (
            <DayCalendar
              date={selectedDate}
              events={visibleEvents}
              onUpdateEvent={updateEvent}
              onEditEvent={setEditingEvent}
              isEventDone={isEventDone}
              onToggleDone={handleToggleDone}
              onDeleteEvent={(event) => removeEvent(event.id)}
              onAddNoteLine={handleAddNoteLine}
              onEditNoteLine={handleEditNoteLine}
              onRemoveNoteLine={(event, lineId) => handleRemoveNoteLine(event.id, lineId)}
              onMergeNoteEvent={handleMergeNoteEvent}
              categoryColors={categoryColors}
            />
          )}
        </div>
      </section>

      <div className="flex w-full flex-col gap-6 overflow-y-auto lg:w-72 lg:shrink-0">
      <section className="rounded-xl bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.08)] dark:bg-[#1c1c1e] dark:shadow-none">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Todos</h2>
          <Link
            href="/other"
            className="text-sm text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
          >
            All todos →
          </Link>
        </div>

        <div className="mt-4">
          {!todosLoaded ? (
            <ListSkeleton rows={4} />
          ) : openTodos.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No todos yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {openTodos.map((todo) => (
                <li
                  key={todo.id}
                  onPointerDown={(e) => startTodoDrag(todo, e)}
                  style={{ touchAction: "none" }}
                  className="group flex cursor-grab items-center gap-3 rounded-md px-2 py-1.5 hover:bg-black/[.02] active:cursor-grabbing dark:hover:bg-white/[.03]"
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
                  {todo.priority && (
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_META[todo.priority].dot}`}
                      aria-label={`${PRIORITY_META[todo.priority].label} priority`}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingTodo(todo)}
                    className={`flex-1 truncate text-left text-sm font-medium ${
                      isOverdue(todo) ? "text-red-500" : ""
                    }`}
                  >
                    {todo.title}
                    {subtaskProgress(todo).total > 0 && (
                      <span className="ml-1 text-xs font-normal text-zinc-400">
                        {subtaskProgress(todo).done}/{subtaskProgress(todo).total}
                      </span>
                    )}
                  </button>
                  {todo.category && <CategoryBadge category={todo.category} />}
                  <button
                    type="button"
                    onClick={() => scheduleTodoForSelectedDate(todo)}
                    aria-label={`Schedule ${todo.title} for ${formatEventDate(selectedDate)}`}
                    title={`Schedule for ${formatEventDate(selectedDate)}`}
                    className="shrink-0 rounded px-1 text-zinc-400 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-white [@media(hover:none)]:opacity-100"
                  >
                    +
                  </button>
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
