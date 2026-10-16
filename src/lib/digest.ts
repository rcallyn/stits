// Builds the text of the Pushover digests. The message formatting is pure
// (and tested); `loadDayPlan` is the only part that touches the database.

import { sql } from "@/lib/db";
import { expandRecurringEvents, formatEventTime, isEventOnDate, ScheduleEvent, timeToMinutes } from "@/lib/schedule";
import type { Todo } from "@/lib/todos";
import { quoteOfTheDay } from "@/lib/quotes";

export type DayPlan = {
  /** Today's events (recurrences expanded), timed by start, all-day last. */
  events: ScheduleEvent[];
  /** Incomplete todos due today or overdue, oldest due date first. */
  dueTodos: Todo[];
  /** Tomorrow's events, same ordering. */
  tomorrow: ScheduleEvent[];
};

const EVENT_LIMIT = 10;
const TODO_LIMIT = 8;

type EventRow = {
  id: string;
  title: string;
  date: string;
  end_date: string | null;
  time: string;
  end_time: string | null;
  category: string | null;
  recurrence: ScheduleEvent["recurrence"] | null;
};

type TodoRow = { id: string; title: string; done: boolean; due_date: string | null };

function byStart(a: ScheduleEvent, b: ScheduleEvent): number {
  return (a.time || "99:99").localeCompare(b.time || "99:99");
}

function eventsOn(events: ScheduleEvent[], date: string): ScheduleEvent[] {
  return expandRecurringEvents(events, date, date)
    .filter((event) => isEventOnDate(event, date))
    .sort(byStart);
}

export async function loadDayPlan(userId: string, today: string, tomorrowDate: string): Promise<DayPlan> {
  const eventRows = await sql<EventRow[]>`
    select id, title, date, end_date, time, end_time, category, recurrence from schedule_events
    where user_id = ${userId}
  `;
  const events: ScheduleEvent[] = eventRows.map((row) => ({
    id: row.id,
    title: row.title,
    date: row.date,
    endDate: row.end_date ?? undefined,
    time: row.time,
    endTime: row.end_time ?? undefined,
    category: (row.category as ScheduleEvent["category"]) ?? undefined,
    recurrence: row.recurrence ?? undefined,
  }));

  const todoRows = await sql<TodoRow[]>`
    select id, title, done, due_date from todos
    where user_id = ${userId} and done = false and due_date is not null
  `;
  const todos: Todo[] = todoRows.map((row) => ({
    id: row.id,
    title: row.title,
    done: row.done,
    dueDate: row.due_date ?? undefined,
  }));

  return {
    events: eventsOn(events, today),
    tomorrow: eventsOn(events, tomorrowDate),
    dueTodos: todos
      .filter((todo) => todo.dueDate !== undefined && todo.dueDate <= today)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
  };
}

function eventLine(event: ScheduleEvent): string {
  return event.time ? `${formatEventTime(event.time)} ${event.title}` : `All day: ${event.title}`;
}

function todoLine(todo: Todo, today: string): string {
  const overdue = !!todo.dueDate && todo.dueDate < today;
  return `${overdue ? "⚠ " : ""}${todo.title}${overdue ? " (overdue)" : ""}`;
}

function limited(lines: string[], total: number, limit: number): string[] {
  return total > limit ? [...lines, `+${total - limit} more`] : lines;
}

/** The 7am message: quote, today's events, then todos due or overdue. */
export function formatMorningDigest(plan: DayPlan, today: string): string {
  const quote = quoteOfTheDay(today);
  const lines: string[] = [`"${quote.text}" — ${quote.author}`, ""];
  if (plan.events.length === 0) {
    lines.push("No events today.");
  } else {
    lines.push(...limited(plan.events.slice(0, EVENT_LIMIT).map(eventLine), plan.events.length, EVENT_LIMIT));
  }
  if (plan.dueTodos.length > 0) {
    lines.push("", "Todos:");
    lines.push(
      ...limited(plan.dueTodos.slice(0, TODO_LIMIT).map((t) => todoLine(t, today)), plan.dueTodos.length, TODO_LIMIT)
    );
  }
  return lines.join("\n");
}

/**
 * The evening "what's left today" message, or null when there's nothing worth
 * a push (no events still ahead, no open todos). `nowMinutes` is minutes since
 * midnight in the user's time zone; timed events that have already started are
 * dropped, all-day events are not (they're still "today").
 */
export function formatEveningRecap(plan: DayPlan, today: string, nowMinutes: number): string | null {
  const remaining = plan.events.filter((event) => !event.time || timeToMinutes(event.time) >= nowMinutes);
  if (remaining.length === 0 && plan.dueTodos.length === 0) return null;

  const lines: string[] = [];
  if (remaining.length > 0) {
    lines.push("Still ahead:");
    lines.push(...limited(remaining.slice(0, EVENT_LIMIT).map(eventLine), remaining.length, EVENT_LIMIT));
  }
  if (plan.dueTodos.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("Still to do:");
    lines.push(
      ...limited(plan.dueTodos.slice(0, TODO_LIMIT).map((t) => todoLine(t, today)), plan.dueTodos.length, TODO_LIMIT)
    );
  }
  const next = plan.tomorrow.find((event) => event.time) ?? plan.tomorrow[0];
  if (next) lines.push("", `Tomorrow: ${eventLine(next)}`);
  return lines.join("\n");
}
