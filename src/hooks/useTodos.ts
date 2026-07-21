"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { TODOS_STORAGE_KEY, Todo, sortTodos } from "@/lib/todos";
import { removeEventsByTodoId } from "@/hooks/useScheduleEvents";

let store: Todo[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setStore(next: Todo[]) {
  store = next;
  window.localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(store));
  emit();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  const raw = window.localStorage.getItem(TODOS_STORAGE_KEY);
  if (raw) {
    try {
      store = sortTodos(JSON.parse(raw));
    } catch {
      store = [];
    }
  }
  hydrated = true;
  emit();
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
    setStore(sortTodos([...store, { ...todo, id: crypto.randomUUID(), done: false }]));
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setStore(
      sortTodos(store.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)))
    );
  }, []);

  const updateTodo = useCallback((id: string, changes: Partial<Omit<Todo, "id">>) => {
    setStore(
      sortTodos(store.map((todo) => (todo.id === id ? { ...todo, ...changes } : todo)))
    );
  }, []);

  const removeTodo = useCallback((id: string) => {
    setStore(store.filter((todo) => todo.id !== id));
    removeEventsByTodoId(id);
  }, []);

  return { todos, loaded, addTodo, toggleTodo, updateTodo, removeTodo };
}
