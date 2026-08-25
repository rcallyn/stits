import { Category } from "@/lib/categories";
import { todayISODate } from "@/lib/schedule";

export type TodoPriority = "high" | "medium" | "low";

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
};

export type Todo = {
  id: string;
  title: string;
  dueDate?: string; // YYYY-MM-DD
  done: boolean;
  category?: Category; // undefined = general todo, otherwise from the Other tab
  priority?: TodoPriority;
  subtasks?: Subtask[];
  completedAt?: string; // ISO timestamp, set when `done` becomes true
  canvasId?: string; // set when this todo mirrors a Canvas planner item —
  // drives upsert/removal matching on re-sync
};

export const TODOS_STORAGE_KEY = "stits:todos";

export const PRIORITY_META: Record<TodoPriority, { label: string; dot: string; text: string }> = {
  high: { label: "High", dot: "bg-red-500", text: "text-red-500" },
  medium: { label: "Medium", dot: "bg-amber-500", text: "text-amber-500" },
  low: { label: "Low", dot: "bg-sky-500", text: "text-sky-500" },
};

const PRIORITY_RANK: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

export function isOverdue(todo: Pick<Todo, "dueDate" | "done">): boolean {
  return Boolean(todo.dueDate) && !todo.done && todo.dueDate! < todayISODate();
}

export function subtaskProgress(todo: Pick<Todo, "subtasks">): { done: number; total: number } {
  const subtasks = todo.subtasks ?? [];
  return { done: subtasks.filter((s) => s.done).length, total: subtasks.length };
}

export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const aPriority = a.priority ? PRIORITY_RANK[a.priority] : 3;
    const bPriority = b.priority ? PRIORITY_RANK[b.priority] : 3;
    if (aPriority !== bPriority) return aPriority - bPriority;
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}
