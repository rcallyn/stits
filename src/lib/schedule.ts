import { Category } from "@/lib/categories";

export type ScheduleEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM, may be empty for all-day
  endTime?: string; // HH:MM, defaults to +1hr from time when absent
  todoId?: string; // links back to the todo this was scheduled from
  category?: Category; // copied from the source todo, for color-coding
};

const DEFAULT_DURATION_MINUTES = 15;
export const MIN_DURATION_MINUTES = 15;

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
