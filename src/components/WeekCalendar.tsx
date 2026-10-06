"use client";

import { useEffect, useRef } from "react";
import { Category } from "@/lib/categories";
import { useHoveredDropZone } from "@/hooks/useTodoDrag";
import { resolveColor } from "@/lib/itemColor";
import { weekDates } from "@/lib/monthGrid";
import {
  eventDurationMinutes,
  expandRecurringEvents,
  formatEventTime,
  isEventOnDate,
  layoutDayEvents,
  minutesToTime,
  scheduleEventKind,
  ScheduleEvent,
  timeToMinutes,
  todayISODate,
} from "@/lib/schedule";

const HOUR_HEIGHT = 56; // px — taller than DayCalendar's single-day grid since
// this view has more surrounding chrome to visually compete with.
const PX_PER_MINUTE = HOUR_HEIGHT / 60;
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 21;
const GUTTER_WIDTH = 48;
const ALL_DAY_VISIBLE = 2;

type Props = {
  selectedDate: string;
  events: ScheduleEvent[];
  categoryColors?: Partial<Record<Category, string>>;
  onSelectDay: (date: string) => void;
  onEditEvent?: (event: ScheduleEvent) => void;
  isEventDone?: (event: ScheduleEvent) => boolean;
};

export default function WeekCalendar({
  selectedDate,
  events,
  categoryColors,
  onSelectDay,
  onEditEvent,
  isEventDone,
}: Props) {
  const days = weekDates(selectedDate);
  const today = todayISODate();
  const expanded = expandRecurringEvents(events, days[0], days[days.length - 1]);
  const timed = expanded.filter((e) => e.time);

  const startHour = timed.length
    ? Math.min(DEFAULT_START_HOUR, ...timed.map((e) => Math.floor(timeToMinutes(e.time) / 60)))
    : DEFAULT_START_HOUR;
  const endHour = timed.length
    ? Math.max(
        DEFAULT_END_HOUR,
        ...timed.map((e) => Math.ceil((timeToMinutes(e.time) + eventDurationMinutes(e)) / 60))
      )
    : DEFAULT_END_HOUR;

  const rangeStartMinutes = startHour * 60;
  const rangeEndMinutes = endHour * 60;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const totalHeight = hours.length * HOUR_HEIGHT;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine = nowMinutes >= rangeStartMinutes && nowMinutes <= rangeEndMinutes;

  const hasAllDay = expanded.some((e) => !e.time);
  const hoveredZone = useHoveredDropZone();

  const scrollRef = useRef<HTMLDivElement>(null);

  // On mobile the day columns overflow horizontally (see the overflow-x-auto
  // wrapper below), so whichever week is showing opens scrolled to its start
  // rather than to today. Whenever the visible week changes and it happens
  // to be the current one, center today's column instead of leaving it to a
  // manual swipe. Recomputed from selectedDate (rather than depending on the
  // `days`/`today` values above, which are new array/value references every
  // render) so this doesn't refight the user's own scrolling on every
  // unrelated re-render.
  useEffect(() => {
    const weekDays = weekDates(selectedDate);
    const currentToday = todayISODate();
    if (!weekDays.includes(currentToday)) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-date="${currentToday}"]`);
    if (!el) return;
    try {
      // "auto" (not "smooth") still jumps immediately rather than animating —
      // "instant" is spec'd too, but Safari/WebKit has a long-standing bug
      // where it throws instead of scrolling, which took the whole page down
      // with it since this runs unguarded on every Dashboard load.
      el.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
    } catch {
      // A cosmetic scroll position is never worth crashing the page over.
    }
  }, [selectedDate]);

  return (
    <div ref={scrollRef} className="flex flex-col overflow-x-auto">
      <div className="min-w-max">
      <div className="flex border-b border-black/[.08] dark:border-white/[.145]">
        <div
          style={{ width: GUTTER_WIDTH }}
          className="sticky left-0 z-10 shrink-0 bg-background"
        />
        {days.map((date) => {
          const [y, m, d] = date.split("-").map(Number);
          const weekday = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short" });
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              data-drop-zone="allday"
              data-drop-date={date}
              onClick={() => onSelectDay(date)}
              className={`flex min-w-[100px] flex-1 flex-col items-center gap-1 py-2 transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.05] ${
                hoveredZone?.kind === "allday" && hoveredZone.date === date
                  ? "bg-[#0071e3]/10 ring-2 ring-inset ring-[#0071e3]"
                  : ""
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                {weekday}
              </span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                  isToday ? "bg-[#0071e3] font-semibold text-white" : ""
                }`}
              >
                {d}
              </span>
            </button>
          );
        })}
      </div>

      {hasAllDay && (
        <div className="flex border-b border-black/[.08] dark:border-white/[.145]">
          <div
            style={{ width: GUTTER_WIDTH }}
            className="sticky left-0 z-10 shrink-0 bg-background"
          />
          {days.map((date) => {
            const allDayEvents = expanded.filter((e) => isEventOnDate(e, date) && !e.time);
            return (
              <div key={date} className="flex min-w-[100px] flex-1 flex-col gap-0.5 px-1 py-1">
                {allDayEvents.slice(0, ALL_DAY_VISIBLE).map((event) => {
                  const color = resolveColor(event.todoId ?? event.id, event.category, categoryColors);
                  const kind = scheduleEventKind(event);
                  const fill = kind === "note" ? color.soft : kind === "todo" ? color.strong : color.solid;
                  const done = isEventDone?.(event) ?? false;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEditEvent?.(event)}
                      title={event.title}
                      className={`truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight ${fill} ${
                        done ? "opacity-60" : ""
                      }`}
                    >
                      <span className={done ? "line-through" : ""}>{event.title}</span>
                    </button>
                  );
                })}
                {allDayEvents.length > ALL_DAY_VISIBLE && (
                  <span className="px-1 text-[9px] text-zinc-400">
                    +{allDayEvents.length - ALL_DAY_VISIBLE} more
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex">
        <div
          className="sticky left-0 z-10 relative shrink-0 bg-background"
          style={{ width: GUTTER_WIDTH, height: totalHeight }}
        >
          {hours.map((hour) => (
            <span
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[11px] text-zinc-400"
              style={{ top: (hour - startHour) * HOUR_HEIGHT }}
            >
              {formatHour(hour)}
            </span>
          ))}
        </div>

        {days.map((date) => {
          const dayEvents = expanded.filter((e) => isEventOnDate(e, date) && e.time);
          const positioned = layoutDayEvents(dayEvents);
          const isToday = date === today;

          const isHoveredTimed = hoveredZone?.kind === "timed" && hoveredZone.date === date;

          return (
            <div
              key={date}
              data-drop-zone="timed"
              data-drop-date={date}
              data-drop-start={rangeStartMinutes}
              data-drop-end={rangeEndMinutes}
              className={`relative min-w-[100px] flex-1 border-l border-black/[.08] dark:border-white/[.145] ${
                isHoveredTimed ? "bg-[#0071e3]/5" : ""
              }`}
              style={{ height: totalHeight }}
            >
              {isHoveredTimed && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                  style={{ top: (hoveredZone.minutes - rangeStartMinutes) * PX_PER_MINUTE }}
                >
                  <div className="h-0.5 flex-1 bg-[#0071e3]" />
                  <span className="ml-1 shrink-0 rounded bg-[#0071e3] px-1 text-[10px] font-medium text-white">
                    {formatEventTime(minutesToTime(hoveredZone.minutes))}
                  </span>
                </div>
              )}

              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-black/[.06] dark:border-white/[.08]"
                  style={{ top: (hour - startHour) * HOUR_HEIGHT }}
                />
              ))}

              {isToday && showNowLine && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10"
                  style={{ top: (nowMinutes - rangeStartMinutes) * PX_PER_MINUTE }}
                >
                  <div className="relative border-t-2 border-red-500">
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                  </div>
                </div>
              )}

              {positioned.map(({ event, column, columns }) => {
                const start = timeToMinutes(event.time);
                const duration = eventDurationMinutes(event);
                const top = (start - rangeStartMinutes) * PX_PER_MINUTE;
                const height = Math.max(duration * PX_PER_MINUTE, 16);
                const widthPct = 100 / columns;
                const color = resolveColor(event.todoId ?? event.id, event.category, categoryColors);
                const kind = scheduleEventKind(event);
                const fill = kind === "note" ? color.soft : kind === "todo" ? color.strong : color.solid;
                const done = isEventDone?.(event) ?? false;

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onEditEvent?.(event)}
                    title={event.title}
                    className={`absolute overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight transition-opacity hover:opacity-90 ${fill} ${
                      done ? "opacity-60" : ""
                    }`}
                    style={{
                      top,
                      height,
                      left: `${widthPct * column}%`,
                      width: `calc(${widthPct}% - 2px)`,
                    }}
                  >
                    <span className={done ? "line-through" : ""}>
                      {event.isRecurringInstance && "↻ "}
                      {event.time && <span className="opacity-80">{formatEventTime(event.time)} </span>}
                      {event.title}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

function formatHour(hour: number) {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}
