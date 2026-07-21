export type Todo = {
  id: string;
  title: string;
  dueDate?: string; // YYYY-MM-DD
  done: boolean;
};

export const TODOS_STORAGE_KEY = "stits:todos";

export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}
