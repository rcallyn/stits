"use client";

import { FormEvent, useState } from "react";
import { useScheduleEvents } from "@/hooks/useScheduleEvents";
import { formatEventDate, formatEventTime } from "@/lib/schedule";

export default function SchedulePage() {
  const { events, loaded, addEvent, removeEvent } = useScheduleEvents();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");

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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Your events will show up here.
        </p>
      </div>

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
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] dark:border-white/[.145] dark:focus:border-white/[.4]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] dark:border-white/[.145] dark:focus:border-white/[.4]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Start
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] dark:border-white/[.145] dark:focus:border-white/[.4]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          End
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={!time}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] disabled:opacity-40 dark:border-white/[.145] dark:focus:border-white/[.4]"
          />
        </label>
        <button
          type="submit"
          className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Add event
        </button>
      </form>

      {loaded && events.length === 0 && (
        <div className="rounded-lg border border-dashed border-black/[.12] p-8 text-center text-sm text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
          No schedule items yet.
        </div>
      )}

      {events.length > 0 && (
        <ul className="flex flex-col gap-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between rounded-lg border border-black/[.08] px-4 py-3 dark:border-white/[.145]"
            >
              <div>
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {formatEventDate(event.date)}
                  {event.time ? ` · ${formatEventTime(event.time)}` : ""}
                  {event.time && event.endTime ? ` – ${formatEventTime(event.endTime)}` : ""}
                </p>
              </div>
              <button
                onClick={() => removeEvent(event.id)}
                className="text-sm text-zinc-400 transition-colors hover:text-red-500"
                aria-label={`Remove ${event.title}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

