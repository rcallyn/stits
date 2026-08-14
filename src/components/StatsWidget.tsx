import { expandRecurringEvents, isEventOnDate, ScheduleEvent, shiftISODate, todayISODate } from "@/lib/schedule";
import { isOverdue, Todo } from "@/lib/todos";

type Props = {
  todos: Todo[];
  events: ScheduleEvent[];
};

export default function StatsWidget({ todos, events }: Props) {
  const today = todayISODate();
  const weekAgoDate = shiftISODate(today, -7);
  const weekAheadDate = shiftISODate(today, 6);
  const expandedEvents = expandRecurringEvents(events, today, weekAheadDate);

  const tiles = [
    { label: "Open todos", value: todos.filter((t) => !t.done).length },
    {
      label: "Completed this week",
      value: todos.filter((t) => t.completedAt && t.completedAt >= weekAgoDate).length,
    },
    {
      label: "Overdue",
      value: todos.filter(isOverdue).length,
      alert: todos.some(isOverdue),
    },
    {
      label: "Next 7 days",
      value: expandedEvents.filter(
        (e) => isEventOnDate(e, today) || (e.date >= today && e.date <= weekAheadDate)
      ).length,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.145]">
          <p className={`text-2xl font-semibold ${tile.alert ? "text-red-500" : ""}`}>{tile.value}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}
