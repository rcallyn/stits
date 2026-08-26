"use client";

import { FormEvent, useState } from "react";
import Modal from "@/components/Modal";
import { AttachedNote, RecurrenceFrequency, RecurrenceRule, ScheduleEvent } from "@/lib/schedule";
import { Category, CATEGORY_LIST, isCategory } from "@/lib/categories";
import { useCategoryLabels } from "@/hooks/useCategoryLabels";

const fieldClass =
  "rounded-[10px] border border-black/[.06] bg-black/[.025] px-3 py-2 text-sm outline-none transition-colors focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 dark:border-white/[.08] dark:bg-white/[.05] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]/20";

type SaveChanges = {
  title: string;
  date: string;
  endDate?: string;
  time: string;
  endTime?: string;
  category?: Category;
  notes?: AttachedNote[];
  recurrence?: RecurrenceRule;
};

type Props = {
  event: ScheduleEvent;
  onSave: (id: string, changes: SaveChanges) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export default function EventEditModal({ event, onSave, onDelete, onClose }: Props) {
  const { labelFor } = useCategoryLabels();
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.date);
  const [endDate, setEndDate] = useState(event.endDate ?? "");
  const [time, setTime] = useState(event.time);
  const [endTime, setEndTime] = useState(event.endTime ?? "");
  const [category, setCategory] = useState(event.category ?? "");
  const [freq, setFreq] = useState<RecurrenceFrequency | "">(event.recurrence?.freq ?? "");
  const [interval, setInterval] = useState(event.recurrence?.interval ?? 1);
  const [notes, setNotes] = useState<AttachedNote[]>(event.notes ?? []);
  const [newNoteText, setNewNoteText] = useState("");

  function addNoteLine() {
    const trimmed = newNoteText.trim();
    if (!trimmed) return;
    setNotes((prev) => [...prev, { id: crypto.randomUUID(), text: trimmed }]);
    setNewNoteText("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    onSave(event.id, {
      title: title.trim(),
      date,
      endDate: !freq && endDate && endDate > date ? endDate : undefined,
      time,
      endTime: time && endTime ? endTime : undefined,
      category: isCategory(category) ? category : undefined,
      notes: notes.length ? notes : undefined,
      recurrence: freq
        ? {
            freq,
            interval: Math.max(1, interval),
            until: event.recurrence?.until,
            exceptions: event.recurrence?.exceptions,
          }
        : undefined,
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

        <label className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          Tag
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={fieldClass}
          >
            <option value="">None</option>
            {CATEGORY_LIST.map(([key]) => (
              <option key={key} value={key}>
                {labelFor(key)}
              </option>
            ))}
          </select>
        </label>

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

        <div className="flex flex-col gap-2 rounded-md bg-black/[.03] px-3 py-2 dark:bg-white/[.05]">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">📝 Notes</p>
          {notes.map((note) => (
            <div key={note.id} className="flex items-start justify-between gap-2">
              <p className="flex-1 text-sm">{note.text}</p>
              <button
                type="button"
                onClick={() => setNotes((prev) => prev.filter((n) => n.id !== note.id))}
                className="shrink-0 text-xs text-zinc-400 transition-colors hover:text-red-500"
                aria-label="Remove note"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNoteLine();
                }
              }}
              placeholder="Add a note…"
              className={`${fieldClass} flex-1 text-sm`}
            />
            <button
              type="button"
              onClick={addNoteLine}
              className="shrink-0 rounded-md border border-[#0071e3]/40 px-3 text-sm text-[#0071e3] transition-colors hover:bg-[#0071e3]/[.06] dark:border-[#2997ff]/40 dark:text-[#2997ff] dark:hover:bg-[#2997ff]/[.1]"
            >
              Add
            </button>
          </div>
        </div>

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
            className="h-10 rounded-lg bg-[#0071e3] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0077ed] active:bg-[#006edb]"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
