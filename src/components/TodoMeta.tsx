import { formatEventDate } from "@/lib/schedule";
import { isOverdue, PRIORITY_META, subtaskProgress, Todo } from "@/lib/todos";

export default function TodoMeta({ todo }: { todo: Todo }) {
  const overdue = isOverdue(todo);
  const { done, total } = subtaskProgress(todo);
  if (!todo.dueDate && !todo.priority && total === 0) return null;

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
      {todo.dueDate && (
        <span className={overdue ? "font-medium text-red-500" : "text-zinc-500 dark:text-zinc-400"}>
          {overdue ? "Overdue" : "Due"} {formatEventDate(todo.dueDate)}
        </span>
      )}
      {todo.priority && (
        <span className={`flex items-center gap-1 ${PRIORITY_META[todo.priority].text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_META[todo.priority].dot}`} />
          {PRIORITY_META[todo.priority].label}
        </span>
      )}
      {total > 0 && (
        <span className="text-zinc-500 dark:text-zinc-400">
          {done}/{total} subtasks
        </span>
      )}
    </div>
  );
}
