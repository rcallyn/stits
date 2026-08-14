"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { baseEventId, SCHEDULE_STORAGE_KEY, ScheduleEvent, sortEvents } from "@/lib/schedule";

let store: ScheduleEvent[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setStore(next: ScheduleEvent[]) {
  store = next;
  window.localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(store));
  emit();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  const raw = window.localStorage.getItem(SCHEDULE_STORAGE_KEY);
  if (raw) {
    try {
      store = sortEvents(JSON.parse(raw));
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

// Callable outside the hook (e.g. from useTodos) so deleting a todo can
// cascade-remove any schedule instances it was dragged onto. Guards with
// ensureHydrated so a caller that mounts before any useScheduleEvents
// consumer doesn't wipe localStorage with an empty in-memory store.
export function removeEventsByTodoId(todoId: string) {
  ensureHydrated();
  setStore(store.filter((event) => event.todoId !== todoId));
}

const EMPTY_EVENTS: ScheduleEvent[] = [];

export function useScheduleEvents() {
  useEffect(() => {
    ensureHydrated();
  }, []);

  const events = useSyncExternalStore(
    subscribe,
    getStoreSnapshot,
    () => EMPTY_EVENTS
  );
  const loaded = useSyncExternalStore(subscribe, getHydratedSnapshot, () => false);

  const addEvent = useCallback((event: Omit<ScheduleEvent, "id">) => {
    setStore(sortEvents([...store, { ...event, id: crypto.randomUUID() }]));
  }, []);

  // `id` may be a virtual recurring-occurrence id (`realId::date`) — always
  // resolves back to the real stored event, so acting on any occurrence
  // acts on the whole series.
  const removeEvent = useCallback((id: string) => {
    const realId = baseEventId(id);
    setStore(store.filter((event) => event.id !== realId));
  }, []);

  // Re-inserts a previously-removed event with its original id intact, for undo.
  const restoreEvent = useCallback((event: ScheduleEvent) => {
    setStore(sortEvents([...store.filter((e) => e.id !== event.id), event]));
  }, []);

  const updateEvent = useCallback(
    (
      id: string,
      changes: Partial<
        Pick<
          ScheduleEvent,
          "title" | "date" | "endDate" | "time" | "endTime" | "done" | "notes" | "recurrence"
        >
      >
    ) => {
      const realId = baseEventId(id);
      setStore(
        sortEvents(store.map((event) => (event.id === realId ? { ...event, ...changes } : event)))
      );
    },
    []
  );

  return { events, loaded, addEvent, removeEvent, restoreEvent, updateEvent };
}
