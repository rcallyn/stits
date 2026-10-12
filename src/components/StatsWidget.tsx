import { ReactNode } from "react";
import { shiftISODate, todayISODate } from "@/lib/schedule";
import { Todo } from "@/lib/todos";

type Props = {
  todos: Todo[];
  /** Rendered as a card filling the rest of the row (the dashboard's quick add). */
  children?: ReactNode;
};

export default function StatsWidget({ todos, children }: Props) {
  const weekAgoDate = shiftISODate(todayISODate(), -7);

  const tiles = [
    { label: "Open todos", value: todos.filter((t) => !t.done).length },
    {
      label: "Completed this week",
      value: todos.filter((t) => t.completedAt && t.completedAt >= weekAgoDate).length,
    },
  ];

  const card = "rounded-xl bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,0.08)] dark:bg-[#1c1c1e] dark:shadow-none";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className={card}>
          <p className="text-2xl font-semibold">{tile.value}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{tile.label}</p>
        </div>
      ))}
      {children && <div className={`col-span-2 flex flex-col justify-center ${card}`}>{children}</div>}
    </div>
  );
}
