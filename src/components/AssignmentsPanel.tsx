"use client";

import { formatEventDate, shiftISODate, todayISODate } from "@/lib/schedule";
import { isOverdue, Todo } from "@/lib/todos";
import { startTodoDrag } from "@/hooks/useTodoDrag";
import { ListSkeleton } from "@/components/Skeleton";

// Canvas-synced assignments, kept out of the Todos list. Shows what's overdue
// or due in the next two weeks; anything further out is just counted.
const UPCOMING_DAYS = 14;

type Props = {
  assignments: Todo[];
  loaded: boolean;
  onToggle: (id: string) => void;
  onEdit: (todo: Todo) => void;
};

function dueLabel(dueDate: string, today: string): string {
  if (dueDate === today) return "Today";
  if (dueDate === shiftISODate(today, 1)) return "Tomorrow";
  return formatEventDate(dueDate);
}

export default function AssignmentsPanel({ assignments, loaded, onToggle, onEdit }: Props) {
  const today = todayISODate();
  const horizon = shiftISODate(today, UPCOMING_DAYS);
  const open = assignments
    .filter((todo) => !todo.done)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const shown = open.filter((todo) => !todo.dueDate || todo.dueDate <= horizon);
  const laterCount = open.length - shown.length;

  return (
    <section className="flex min-h-0 flex-col rounded-xl bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,0.08)] dark:bg-[#1c1c1e] dark:shadow-none lg:w-72 lg:shrink-0">
      <h2 className="text-lg font-semibold">Assignments</h2>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {!loaded ? (
          <ListSkeleton rows={4} />
        ) : shown.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {laterCount > 0 ? "Nothing due in the next two weeks." : "No assignments due."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {shown.map((todo) => (
              <li
                key={todo.id}
                onPointerDown={(e) => startTodoDrag(todo, e)}
                style={{ touchAction: "none" }}
                className="flex cursor-grab items-start gap-3 rounded-md px-2 py-1.5 hover:bg-black/[.02] active:cursor-grabbing dark:hover:bg-white/[.03]"
              >
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => onToggle(todo.id)}
                  aria-label={`Mark ${todo.title} done`}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <button
                  type="button"
                  onClick={() => onEdit(todo)}
                  className="flex min-w-0 flex-1 flex-col text-left"
                >
                  <span className="text-sm font-medium leading-snug">{todo.title}</span>
                  {todo.dueDate && (
                    <span
                      className={`text-xs ${
                        isOverdue(todo) ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {isOverdue(todo) ? "Overdue · " : "Due "}
                      {dueLabel(todo.dueDate, today)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {loaded && laterCount > 0 && (
          <p className="mt-3 px-2 text-xs text-zinc-400">+{laterCount} due later</p>
        )}
      </div>
    </section>
  );
}
