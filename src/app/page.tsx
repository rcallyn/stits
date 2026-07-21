"use client";

import Link from "next/link";
import { useScheduleEvents } from "@/hooks/useScheduleEvents";
import { todayISODate } from "@/lib/schedule";
import DayCalendar from "@/components/DayCalendar";
import { useTodos } from "@/hooks/useTodos";
import QuickAdd from "@/components/QuickAdd";

export default function Home() {
  const { events, loaded: eventsLoaded, updateEvent } = useScheduleEvents();
  const { todos, loaded: todosLoaded } = useTodos();
  const todayEvents = events.filter((event) => event.date === todayISODate());
  const openTodos = todos.filter((todo) => !todo.done);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          A quick overview of your day.
        </p>
      </div>

      <QuickAdd />

      <section className="rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Today</h2>
          <Link
            href="/schedule"
            className="text-sm text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
          >
            Full schedule →
          </Link>
        </div>

        <div className="mt-4">
          {!eventsLoaded ? null : todayEvents.length === 0 ? (
            <p className="flex h-32 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
              Nothing planned for today.
            </p>
          ) : (
            <DayCalendar events={todayEvents} onUpdateEvent={updateEvent} />
          )}
        </div>
      </section>

      <Link
        href="/todos"
        className="rounded-lg border border-black/[.08] p-5 transition-colors hover:bg-black/[.02] dark:border-white/[.145] dark:hover:bg-white/[.03]"
      >
        <h2 className="font-medium">Todos</h2>
        {!todosLoaded ? null : openTodos.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            No todos yet.
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {openTodos.length} open {openTodos.length === 1 ? "todo" : "todos"}
          </p>
        )}
      </Link>
    </main>
  );
}
