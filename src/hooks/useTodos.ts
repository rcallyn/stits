"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Todo, sortTodos } from "@/lib/todos";
import type { ScheduleEvent } from "@/lib/schedule";
import { createEntityStore } from "@/lib/createEntityStore";
import { pushToast } from "@/lib/toast";
import { eventStore } from "@/hooks/useScheduleEvents";

const JSON_HEADERS = { "Content-Type": "application/json" };

export const todoStore = createEntityStore<Todo>({
  endpoint: "/api/todos",
  fromResponse: (data) => sortTodos((data as { todos?: Todo[] }).todos ?? []),
  noun: "todo",
  offlineKey: "todos",
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

  // Re-creates a deleted todo along with the schedule events that were linked
  // to it (the delete cascaded to them). The server assigns new ids, so the
  // events are re-pointed at the new todo.
  const restoreTodo = useCallback((todo: Todo, linkedEvents: ScheduleEvent[]) => {
    todoStore.mutate(
      (cur) => sortTodos([...cur.filter((t) => t.id !== todo.id), todo]),
      async () => {
        const res = await fetch("/api/todos", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(todo),
        });
        if (!res.ok) return res;
        const { todo: created } = (await res.clone().json()) as { todo: Todo };
        for (const event of linkedEvents) {
          await fetch("/api/events", {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({ ...event, todoId: created.id }),
          });
        }
        return res;
      },
      { action: "restore", afterRefresh: () => eventStore.refresh() }
    );
  }, []);

  const removeTodo = useCallback(
    (id: string) => {
      const removed = todoStore.getAll().find((todo) => todo.id === id);
      const linkedEvents = eventStore.getAll().filter((event) => event.todoId === id);
      todoStore.mutate(
        (cur) => cur.filter((todo) => todo.id !== id),
        () => fetch(`/api/todos/${id}`, { method: "DELETE" }),
        // A todo delete cascades to its linked schedule events in Postgres;
        // refetch that store too so its cache matches.
        { action: "delete", afterRefresh: () => eventStore.refresh() }
      );
      if (removed) {
        pushToast(`Deleted “${removed.title}”.`, "info", 8000, {
          label: "Undo",
          run: () => restoreTodo(removed, linkedEvents),
        });
      }
    },
    [restoreTodo]
  );

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
