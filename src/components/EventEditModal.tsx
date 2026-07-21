"use client";

import { FormEvent, useState } from "react";
import Modal from "@/components/Modal";
import { ScheduleEvent } from "@/lib/schedule";

const fieldClass =
  "rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] dark:border-white/[.145] dark:focus:border-white/[.4]";

type Props = {
  event: ScheduleEvent;
  onSave: (id: string, changes: { title: string; date: string; time: string; endTime?: string }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export default function EventEditModal({ event, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.date);
  const [time, setTime] = useState(event.time);
  const [endTime, setEndTime] = useState(event.endTime ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    onSave(event.id, {
      title: title.trim(),
      date,
      time,
      endTime: time && endTime ? endTime : undefined,
    });
    onClose();
  }

  return (
    <Modal title="Edit event" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
        <label className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={fieldClass}
          />
        </label>
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
