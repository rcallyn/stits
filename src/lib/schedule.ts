import { Category } from "@/lib/categories";

// A note attached directly to a schedule item. `sourceNoteId` is set when it
// came from a real Note (dragged/placed from the Other tab); absent when it
// was typed straight onto the event and only ever lived here.
export type AttachedNote = {
  id: string;
  text: string;
  sourceNoteId?: string;
};

export type RecurrenceFrequency = "daily" | "weekly" | "monthly";
export type RecurrenceRule = { freq: RecurrenceFrequency; interval: number };

export type ScheduleEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD — start date; also the recurrence anchor
  endDate?: string; // YYYY-MM-DD — for multi-day spans; ignored if `recurrence` is set
  time: string; // HH:MM, may be empty for all-day
  endTime?: string; // HH:MM, defaults to +1hr from time when absent
  todoId?: string; // links back to the todo this was scheduled from
  category?: Category; // copied from the source todo, for color-coding
  done?: boolean; // only meaningful for events with no todoId; todo-linked
  // events use the linked todo's done state instead
  notes?: AttachedNote[];
  isNoteEvent?: boolean; // true if this entry exists primarily to hold a
  // note placed onto an empty slot (vs. a todo or a plain typed event that
  // happens to have notes attached) — drives its visual "kind" on the calendar
  recurrence?: RecurrenceRule;
  isRecurringInstance?: boolean; // never persisted — set only on the virtual
  // per-occurrence copies produced by expandRecurringEvents()
};

export type ScheduleEventKind = "todo" | "note" | "event";

export function scheduleEventKind(event: Pick<ScheduleEvent, "todoId" | "isNoteEvent">): ScheduleEventKind {
  if (event.todoId) return "todo";
  if (event.isNoteEvent) return "note";
  return "event";
}

const DEFAULT_DURATION_MINUTES = 15;
export const MIN_DURATION_MINUTES = 15;
export const NOTE_TITLE_MAX_LENGTH = 60;

export function truncateForTitle(text: string, max = NOTE_TITLE_MAX_LENGTH): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export const SCHEDULE_STORAGE_KEY = "stits:schedule-events";

export function sortEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort((a, b) => {
    const aKey = `${a.date}T${a.time || "00:00"}`;
    const bKey = `${b.date}T${b.time || "00:00"}`;
    return aKey.localeCompare(bKey);
  });
}

export function formatEventDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatEventTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function eventDurationMinutes(event: ScheduleEvent): number {
  if (!event.time) return 0;
  if (!event.endTime) return DEFAULT_DURATION_MINUTES;
  const duration = timeToMinutes(event.endTime) - timeToMinutes(event.time);
  return Math.max(duration, MIN_DURATION_MINUTES);
}

export function todayISODate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export function shiftISODate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(year, month - 1, day + days);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(
    shifted.getDate()
  ).padStart(2, "0")}`;
}

// True if `dateStr` falls anywhere within a (possibly multi-day) event's span.
export function isEventOnDate(event: Pick<ScheduleEvent, "date" | "endDate">, dateStr: string): boolean {
  const end = event.endDate && event.endDate > event.date ? event.endDate : event.date;
  return dateStr >= event.date && dateStr <= end;
}

// Virtual occurrence ids look like `${realId}::${occurrenceDate}`. Every
// mutation (update/remove/restore) should resolve back to the real stored
// event — editing or deleting an occurrence acts on the whole series.
export function baseEventId(id: string): string {
  const separator = id.indexOf("::");
  return separator === -1 ? id : id.slice(0, separator);
}

function advanceDate(date: string, freq: RecurrenceFrequency, step: number): string {
  const [y, m, d] = date.split("-").map(Number);
  if (freq === "daily") return shiftISODate(date, step);
  if (freq === "weekly") return shiftISODate(date, step * 7);
  const next = new Date(y, m - 1 + step, d);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(
    next.getDate()
  ).padStart(2, "0")}`;
}

// Expands recurring events into per-occurrence virtual copies within
// [rangeStart, rangeEnd] (inclusive). Non-recurring events pass through
// unchanged. Recurring events don't also support multi-day spans (`endDate`
// is ignored once `recurrence` is set) — keeps occurrence math unambiguous.
export function expandRecurringEvents(
  events: ScheduleEvent[],
  rangeStart: string,
  rangeEnd: string
): ScheduleEvent[] {
  const result: ScheduleEvent[] = [];
  for (const event of events) {
    if (!event.recurrence) {
      result.push(event);
      continue;
    }
    const { freq, interval } = event.recurrence;
    const step = Math.max(1, interval || 1);
    let cursor = event.date;

    // Jump close to rangeStart in one step instead of walking day-by-day from
    // the anchor — otherwise a daily series anchored a year ago wouldn't
    // reach a range that far out before the iteration guard below kicks in.
    if (freq !== "monthly" && rangeStart > cursor) {
      const daysPerOccurrence = freq === "daily" ? step : step * 7;
      const daysBetween = Math.floor(
        (Date.parse(rangeStart) - Date.parse(cursor)) / (24 * 60 * 60 * 1000)
      );
      const occurrencesToSkip = Math.max(0, Math.floor(daysBetween / daysPerOccurrence));
      if (occurrencesToSkip > 0) cursor = advanceDate(cursor, freq, step * occurrencesToSkip);
    }

    let guard = 0;
    while (cursor <= rangeEnd && guard < 500) {
      if (cursor >= rangeStart) {
        result.push({ ...event, id: `${event.id}::${cursor}`, date: cursor, isRecurringInstance: true });
      }
      cursor = advanceDate(cursor, freq, step);
      guard++;
    }
  }
  return result;
}
