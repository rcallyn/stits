"use client";

import { FormEvent, useState } from "react";
import Modal from "@/components/Modal";
import { RecurrenceFrequency, ScheduleEvent } from "@/lib/schedule";

const fieldClass =
  "rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] dark:border-white/[.145] dark:focus:border-white/[.4]";

type SaveChanges = {
  title: string;
  date: string;
  endDate?: string;
  time: string;
  endTime?: string;
  recurrence?: { freq: RecurrenceFrequency; interval: number };
};

type Props = {
  event: ScheduleEvent;
  onSave: (id: string, changes: SaveChanges) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onRemoveNoteLine?: (eventId: string, lineId: string) => void;
};

export default function EventEditModal({
  event,
  onSave,
  onDelete,
  onClose,
  onRemoveNoteLine,
}: Props) {
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.date);
  const [endDate, setEndDate] = useState(event.endDate ?? "");
  const [time, setTime] = useState(event.time);
  const [endTime, setEndTime] = useState(event.endTime ?? "");
  const [freq, setFreq] = useState<RecurrenceFrequency | "">(event.recurrence?.freq ?? "");
  const [interval, setInterval] = useState(event.recurrence?.interval ?? 1);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    onSave(event.id, {
      title: title.trim(),
      date,
      endDate: !freq && endDate && endDate > date ? endDate : undefined,
      time,
      endTime: time && endTime ? endTime : undefined,
      recurrence: freq ? { freq, interval: Math.max(1, interval) } : undefined,
    });
    onClose();
  }

  return (
    <Modal title="Edit event" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {event.isRecurringInstance && (
          <p className="rounded-md bg-black/[.04] px-3 py-2 text-xs text-zinc-500 dark:bg-white/[.06] dark:text-zinc-400">
            This is part of a recurring series — changes here apply to the whole series.
          </p>
        )}
        <label className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={fieldClass}
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={fieldClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={Boolean(freq)}
              className={`${fieldClass} disabled:opacity-40`}
            />
          </label>
        </div>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            Start
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            End
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={!time}
              className={`${fieldClass} disabled:opacity-40`}
            />
          </label>
        </div>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            Repeat
            <select
              value={freq}
              onChange={(e) => setFreq(e.target.value as RecurrenceFrequency | "")}
              className={fieldClass}
            >
              <option value="">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          {freq && (
            <label className="flex w-24 flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
              Every
              <input
                type="number"
                min={1}
                value={interval}
                onChange={(e) => setInterval(Math.max(1, Number(e.target.value) || 1))}
                className={fieldClass}
              />
            </label>
          )}
        </div>

        {event.notes && event.notes.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.145]">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">📝 Notes</p>
            {event.notes.map((note) => (
              <div key={note.id} className="flex items-start justify-between gap-2">
                <p className="flex-1">{note.text}</p>
                {onRemoveNoteLine && (
                  <button
                    type="button"
                    onClick={() => onRemoveNoteLine(event.id, note.id)}
                    className="shrink-0 text-xs text-zinc-400 transition-colors hover:text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onDelete(event.id);
              onClose();
            }}
            className="text-sm text-zinc-400 transition-colors hover:text-red-500"
          >
            Delete
          </button>
          <button
            type="submit"
            className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
