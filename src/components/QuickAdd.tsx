"use client";

import { FormEvent, useState } from "react";
import { useScheduleEvents } from "@/hooks/useScheduleEvents";
import { useTodos } from "@/hooks/useTodos";
import { ParsedItem } from "@/lib/quickAdd";
import { formatEventDate, formatEventTime } from "@/lib/schedule";

const MAX_HISTORY_TITLES = 100;

export default function QuickAdd() {
  const { events, addEvent } = useScheduleEvents();
  const { todos, addTodo } = useTodos();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "error"; message: string }
    | { state: "added"; item: ParsedItem }
  >({ state: "idle" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setStatus({ state: "loading" });
    try {
      const history = Array.from(
        new Set([...events.map((e) => e.title), ...todos.map((t) => t.title)])
      ).slice(0, MAX_HISTORY_TITLES);

      const res = await fetch("/api/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, now: new Date().toString(), history }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus({
          state: "error",
          message: data.error ?? "Something went wrong.",
        });
        return;
      }

      const item: ParsedItem = data.item;
      if (item.kind === "event") {
        addEvent({ title: item.title, date: item.date, time: item.time ?? "", endTime: item.endTime });
      } else {
        addTodo({ title: item.title, dueDate: item.dueDate });
      }

      setStatus({ state: "added", item });
      setText("");
    } catch {
      setStatus({ state: "error", message: "Couldn't reach the server." });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Dentist appointment tomorrow at 3pm"
          className="flex-1 rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.3] dark:border-white/[.145] dark:focus:border-white/[.4]"
        />
        <button
          type="submit"
          disabled={status.state === "loading"}
          className="h-10 shrink-0 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {status.state === "loading" ? "Adding…" : "Add"}
        </button>
      </form>

      {status.state === "error" && (
        <p className="text-sm text-red-500">{status.message}</p>
      )}
      {status.state === "added" && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {status.item.kind === "event" ? (
            <>
              Added event &ldquo;{status.item.title}&rdquo; on{" "}
              {formatEventDate(status.item.date)}
              {status.item.time ? ` · ${formatEventTime(status.item.time)}` : ""}
            </>
          ) : (
            <>
              Added todo &ldquo;{status.item.title}&rdquo;
              {status.item.dueDate
                ? ` · due ${formatEventDate(status.item.dueDate)}`
                : ""}
            </>
          )}
        </p>
      )}
    </div>
  );
}
