"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Todo, sortTodos } from "@/lib/todos";
import { refreshScheduleEventsCache } from "@/hooks/useScheduleEvents";

let store: Todo[] = [];
let hydrated = false;
let hydrating = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setStore(next: Todo[]) {
  store = next;
  emit();
}

async function refresh() {
  try {
    const res = await fetch("/api/todos");
    const data = await res.json();
    setStore(sortTodos(data.todos ?? []));
  } catch {
    // Leave the cache as-is on a network failure — the next successful
    // mutation's refresh will resync it.
  }
}

function ensureHydrated() {
  if (hydrated || hydrating || typeof window === "undefined") return;
  hydrating = true;
  refresh().finally(() => {
    hydrated = true;
    hydrating = false;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getStoreSnapshot() {
  return store;
}

function getHydratedSnapshot() {
  return hydrated;
}

const EMPTY_TODOS: Todo[] = [];

export function useTodos() {
  useEffect(() => {
    ensureHydrated();
  }, []);

  const todos = useSyncExternalStore(subscribe, getStoreSnapshot, () => EMPTY_TODOS);
  const loaded = useSyncExternalStore(subscribe, getHydratedSnapshot, () => false);

  const addTodo = useCallback((todo: Omit<Todo, "id" | "done">) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    setStore(sortTodos([...store, { ...todo, id: tempId, done: false }]));
    fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(todo),
    }).finally(refresh);
  }, []);

  const toggleTodo = useCallback((id: string) => {
    const target = store.find((todo) => todo.id === id);
    if (!target) return;
    const done = !target.done;
    const completedAt = done ? new Date().toISOString() : undefined;
    setStore(sortTodos(store.map((todo) => (todo.id === id ? { ...todo, done, completedAt } : todo))));
    fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done, completedAt: completedAt ?? null }),
    }).finally(refresh);
  }, []);

  const updateTodo = useCallback((id: string, changes: Partial<Omit<Todo, "id">>) => {
    setStore(
      sortTodos(
        store.map((todo) => {
          if (todo.id !== id) return todo;
          const next = { ...todo, ...changes };
          if (changes.done !== undefined && changes.done !== todo.done) {
            next.completedAt = changes.done ? new Date().toISOString() : undefined;
          }
          return next;
        })
      )
    );
    fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    }).finally(refresh);
  }, []);

  const removeTodo = useCallback((id: string) => {
    setStore(store.filter((todo) => todo.id !== id));
    fetch(`/api/todos/${id}`, { method: "DELETE" }).finally(() => {
      refresh();
      refreshScheduleEventsCache();
    });
  }, []);

  const toggleSubtask = useCallback((todoId: string, subtaskId: string) => {
    const target = store.find((todo) => todo.id === todoId);
    if (!target) return;
    const subtasks = (target.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s));
    setStore(sortTodos(store.map((todo) => (todo.id === todoId ? { ...todo, subtasks } : todo))));
    fetch(`/api/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtasks }),
    }).finally(refresh);
  }, []);

  return { todos, loaded, addTodo, toggleTodo, updateTodo, removeTodo, toggleSubtask };
}
