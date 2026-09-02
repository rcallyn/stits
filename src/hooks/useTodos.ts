"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Todo, sortTodos } from "@/lib/todos";
import { createEntityStore } from "@/lib/createEntityStore";
import { eventStore } from "@/hooks/useScheduleEvents";

const JSON_HEADERS = { "Content-Type": "application/json" };

export const todoStore = createEntityStore<Todo>({
  endpoint: "/api/todos",
  fromResponse: (data) => sortTodos((data as { todos?: Todo[] }).todos ?? []),
  noun: "todo",
});

export function useTodos() {
  useEffect(() => {
    todoStore.ensureHydrated();
  }, []);

  const todos = useSyncExternalStore(
    todoStore.subscribe,
    todoStore.getSnapshot,
    todoStore.getServerSnapshot
  );
  const loaded = useSyncExternalStore(
    todoStore.subscribe,
    todoStore.getHydratedSnapshot,
    todoStore.getServerHydratedSnapshot
  );

  const addTodo = useCallback((todo: Omit<Todo, "id" | "done">) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    todoStore.mutate(
      (cur) => sortTodos([...cur, { ...todo, id: tempId, done: false }]),
      () => fetch("/api/todos", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(todo) }),
      { action: "add" }
    );
  }, []);

  const toggleTodo = useCallback((id: string) => {
    const target = todoStore.getAll().find((todo) => todo.id === id);
    if (!target) return;
    const done = !target.done;
    const completedAt = done ? new Date().toISOString() : undefined;
    todoStore.mutate(
      (cur) => sortTodos(cur.map((todo) => (todo.id === id ? { ...todo, done, completedAt } : todo))),
      () =>
        fetch(`/api/todos/${id}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ done, completedAt: completedAt ?? null }),
        }),
      { action: "update" }
    );
  }, []);

  const updateTodo = useCallback((id: string, changes: Partial<Omit<Todo, "id">>) => {
    todoStore.mutate(
      (cur) =>
        sortTodos(
          cur.map((todo) => {
            if (todo.id !== id) return todo;
            const next = { ...todo, ...changes };
            if (changes.done !== undefined && changes.done !== todo.done) {
              next.completedAt = changes.done ? new Date().toISOString() : undefined;
            }
            return next;
          })
        ),
      () =>
        fetch(`/api/todos/${id}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify(changes),
        }),
      { action: "update" }
    );
  }, []);

  const removeTodo = useCallback((id: string) => {
    todoStore.mutate(
      (cur) => cur.filter((todo) => todo.id !== id),
      () => fetch(`/api/todos/${id}`, { method: "DELETE" }),
      // A todo delete cascades to its linked schedule events in Postgres;
      // refetch that store too so its cache matches.
      { action: "delete", afterRefresh: () => eventStore.refresh() }
    );
  }, []);

  const toggleSubtask = useCallback((todoId: string, subtaskId: string) => {
    const target = todoStore.getAll().find((todo) => todo.id === todoId);
    if (!target) return;
    const subtasks = (target.subtasks ?? []).map((s) =>
      s.id === subtaskId ? { ...s, done: !s.done } : s
    );
    todoStore.mutate(
      (cur) => sortTodos(cur.map((todo) => (todo.id === todoId ? { ...todo, subtasks } : todo))),
      () =>
        fetch(`/api/todos/${todoId}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ subtasks }),
        }),
      { action: "update" }
    );
  }, []);

  return { todos, loaded, addTodo, toggleTodo, updateTodo, removeTodo, toggleSubtask };
}
