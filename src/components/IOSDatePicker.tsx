"use client";

import { useEffect, useState } from "react";
import { formatEventDate, todayISODate } from "@/lib/schedule";
import { buildMonthGrid, monthLabel, shiftMonth, WEEKDAY_LETTERS } from "@/lib/monthGrid";

const IOS_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';

type Props = {
  value: string;
  onChange: (date: string) => void;
};

export default function IOSDatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  const [year, month] = value.split("-").map(Number);
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month);

  if (open && !wasOpen) {
    setWasOpen(true);
    setViewYear(year);
    setViewMonth(month);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const weeks = buildMonthGrid(viewYear, viewMonth);
  const isToday = value === todayISODate();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-black/[.12] bg-transparent px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.03] dark:border-white/[.145] dark:hover:bg-white/[.06]"
        style={{ fontFamily: IOS_FONT }}
      >
        <span aria-hidden className="text-[#007AFF]">
          📅
        </span>
        {isToday ? "Today" : formatEventDate(value)}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose a date"
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: IOS_FONT }}
            className="w-full max-w-md rounded-[28px] border border-black/[.06] bg-background/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/[.1]"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const shifted = shiftMonth(viewYear, viewMonth, -1);
                  setViewYear(shifted.year);
                  setViewMonth(shifted.month);
                }}
                aria-label="Previous month"
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#007AFF] transition-colors hover:bg-[#007AFF]/10"
              >
                ‹
              </button>
              <p className="text-lg font-semibold">{monthLabel(viewYear, viewMonth)}</p>
              <button
                type="button"
                onClick={() => {
                  const shifted = shiftMonth(viewYear, viewMonth, 1);
                  setViewYear(shifted.year);
                  setViewMonth(shifted.month);
                }}
                aria-label="Next month"
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#007AFF] transition-colors hover:bg-[#007AFF]/10"
              >
                ›
              </button>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-y-2 text-center">
              {WEEKDAY_LETTERS.map((letter, i) => (
                <span
                  key={i}
                  className="text-xs font-semibold uppercase text-zinc-400 dark:text-zinc-500"
                >
                  {letter}
                </span>
              ))}

              {weeks.map((week, wi) =>
                week.map((cell) => {
                  const selected = cell.date === value;
                  const cellIsToday = cell.date === todayISODate();
                  return (
                    <button
                      key={`${wi}-${cell.date}`}
                      type="button"
                      onClick={() => {
                        onChange(cell.date);
                        setOpen(false);
                      }}
                      className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full text-[15px] transition-colors ${
                        selected
                          ? "bg-[#007AFF] font-semibold text-white"
                          : cellIsToday
                            ? "font-semibold text-[#007AFF]"
                            : cell.inMonth
                              ? "text-foreground hover:bg-black/[.05] dark:hover:bg-white/[.08]"
                              : "text-zinc-300 hover:bg-black/[.05] dark:text-zinc-600 dark:hover:bg-white/[.08]"
                      }`}
                    >
                      {cell.day}
                    </button>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onChange(todayISODate());
                setOpen(false);
              }}
              className="mt-5 w-full rounded-2xl bg-[#007AFF]/10 py-2.5 text-sm font-semibold text-[#007AFF] transition-colors hover:bg-[#007AFF]/15"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </>
  );
}
