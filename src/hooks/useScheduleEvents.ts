"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { baseEventId, ScheduleEvent, sortEvents } from "@/lib/schedule";

let store: ScheduleEvent[] = [];
let hydrated = false;
let hydrating = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setStore(next: ScheduleEvent[]) {
  store = next;
  emit();
}

async function refresh() {
  try {
    const res = await fetch("/api/events");
    const data = await res.json();
    setStore(sortEvents(data.events ?? []));
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

// Callable outside the hook (e.g. from useTodos, after deleting a todo)
// since a todo deletion cascade-deletes its linked schedule events in
// Postgres via the todo_id FK — this refreshes this hook's client-side
// cache to match.
export function refreshScheduleEventsCache() {
  refresh();
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

const EMPTY_EVENTS: ScheduleEvent[] = [];

export function useScheduleEvents() {
  useEffect(() => {
    ensureHydrated();
  }, []);

  const events = useSyncExternalStore(subscribe, getStoreSnapshot, () => EMPTY_EVENTS);
  const loaded = useSyncExternalStore(subscribe, getHydratedSnapshot, () => false);

  const addEvent = useCallback((event: Omit<ScheduleEvent, "id">) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    setStore(sortEvents([...store, { ...event, id: tempId }]));
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).finally(refresh);
  }, []);

  // `id` may be a virtual recurring-occurrence id (`realId::date`) — the API
  // resolves it back to the real stored event, so acting on any occurrence
  // acts on the whole series.
  const removeEvent = useCallback((id: string) => {
    setStore(store.filter((event) => event.id !== baseEventId(id)));
    fetch(`/api/events/${baseEventId(id)}`, { method: "DELETE" }).finally(refresh);
  }, []);

  // Re-inserts a previously-removed event with its original id intact, for undo.
  const restoreEvent = useCallback((event: ScheduleEvent) => {
    setStore(sortEvents([...store.filter((e) => e.id !== event.id), event]));
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).finally(refresh);
  }, []);

  const updateEvent = useCallback(
    (
      id: string,
      changes: Partial<
        Pick<
          ScheduleEvent,
          | "title"
          | "date"
          | "endDate"
          | "time"
          | "endTime"
          | "done"
          | "category"
          | "notes"
          | "recurrence"
        >
      >
    ) => {
      const realId = baseEventId(id);
      setStore(
        sortEvents(store.map((event) => (event.id === realId ? { ...event, ...changes } : event)))
      );
      fetch(`/api/events/${realId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      }).finally(refresh);
    },
    []
  );

  return { events, loaded, addEvent, removeEvent, restoreEvent, updateEvent };
}
