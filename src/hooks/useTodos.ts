"use client";

import { useCallback, useEffect, useState } from "react";
import { TODOS_STORAGE_KEY, Todo, sortTodos } from "@/lib/todos";

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(TODOS_STORAGE_KEY);
    if (raw) {
      try {
        setTodos(sortTodos(JSON.parse(raw)));
      } catch {
        setTodos([]);
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(todos));
    }
  }, [todos, loaded]);

  const addTodo = useCallback((todo: Omit<Todo, "id" | "done">) => {
    setTodos((prev) =>
      sortTodos([...prev, { ...todo, id: crypto.randomUUID(), done: false }])
    );
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) =>
      sortTodos(
        prev.map((todo) =>
          todo.id === id ? { ...todo, done: !todo.done } : todo
        )
      )
    );
  }, []);

  const removeTodo = useCallback((id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  }, []);

  return { todos, loaded, addTodo, toggleTodo, removeTodo };
}
