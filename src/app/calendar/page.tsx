"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useScheduleEvents } from "@/hooks/useScheduleEvents";
import { useCategoryColors } from "@/hooks/useCategoryColors";
import { useJumpToDate } from "@/hooks/useJumpToDate";
import { expandRecurringEvents, isEventOnDate, todayISODate } from "@/lib/schedule";
import { buildMonthGrid, monthLabel, shiftMonth, WEEKDAY_LETTERS } from "@/lib/monthGrid";
import { resolveColor } from "@/lib/itemColor";

const IOS_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';

export default function CalendarPage() {
  const { events, loaded } = useScheduleEvents();
  const { overrides: categoryColors } = useCategoryColors();
  const { setJumpToDate } = useJumpToDate();
  const router = useRouter();

  const today = todayISODate();
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonth);

  const weeks = buildMonthGrid(viewYear, viewMonth);
  const isCurrentMonth = viewYear === todayYear && viewMonth === todayMonth;
  const gridStart = weeks[0][0].date;
  const gridEnd = weeks[weeks.length - 1][6].date;
  const expandedEvents = expandRecurringEvents(events, gridStart, gridEnd);

  function goToMonth(delta: number) {
    const shifted = shiftMonth(viewYear, viewMonth, delta);
    setViewYear(shifted.year);
    setViewMonth(shifted.month);
  }

  function handleDayClick(date: string) {
    setJumpToDate(date);
    router.push("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Tap a day to open it on the Dashboard.
        </p>
      </div>

      <div
        style={{ fontFamily: IOS_FONT }}
        className="rounded-[28px] border border-black/[.06] bg-background p-6 shadow-sm dark:border-white/[.1]"
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#007AFF] transition-colors hover:bg-[#007AFF]/10"
          >
            ‹
          </button>
          <p className="text-lg font-semibold">{monthLabel(viewYear, viewMonth)}</p>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#007AFF] transition-colors hover:bg-[#007AFF]/10"
          >
            ›
          </button>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-y-1 text-center">
          {WEEKDAY_LETTERS.map((letter, i) => (
            <span key={i} className="text-xs font-semibold uppercase text-zinc-400 dark:text-zinc-500">
              {letter}
            </span>
          ))}

          {loaded &&
            weeks.map((week, wi) =>
              week.map((cell) => {
                const dayEvents = expandedEvents.filter((event) => isEventOnDate(event, cell.date));
                const isToday = cell.date === today;
                return (
                  <button
                    key={`${wi}-${cell.date}`}
                    type="button"
                    onClick={() => handleDayClick(cell.date)}
                    className={`flex flex-col items-center gap-1 rounded-2xl py-2 transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.06] ${
                      cell.inMonth ? "" : "opacity-30"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-[15px] ${
                        isToday ? "bg-[#007AFF] font-semibold text-white" : "text-foreground"
                      }`}
                    >
                      {cell.day}
                    </span>
                    <span className="flex h-1.5 items-center gap-0.5">
                      {dayEvents.slice(0, 4).map((event) => (
                        <span
                          key={event.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            resolveColor(event.todoId ?? event.id, event.category, categoryColors).dot
                          }`}
                        />
                      ))}
                    </span>
                  </button>
                );
              })
            )}
        </div>

        {!isCurrentMonth && (
          <button
            type="button"
            onClick={() => {
              setViewYear(todayYear);
              setViewMonth(todayMonth);
            }}
            className="mt-5 w-full rounded-2xl bg-[#007AFF]/10 py-2.5 text-sm font-semibold text-[#007AFF] transition-colors hover:bg-[#007AFF]/15"
          >
            Today
          </button>
        )}
      </div>
    </main>
  );
}
