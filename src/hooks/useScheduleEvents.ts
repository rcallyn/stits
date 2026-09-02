"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { baseEventId, ScheduleEvent, sortEvents } from "@/lib/schedule";
import { createEntityStore } from "@/lib/createEntityStore";

const JSON_HEADERS = { "Content-Type": "application/json" };

export const eventStore = createEntityStore<ScheduleEvent>({
  endpoint: "/api/events",
  fromResponse: (data) => sortEvents((data as { events?: ScheduleEvent[] }).events ?? []),
  noun: "event",
});

// Callable outside the hook (e.g. from useTodos, after deleting a todo) since
// a todo deletion cascade-deletes its linked schedule events in Postgres via
// the todo_id FK — this refreshes this store's client-side cache to match.
export function refreshScheduleEventsCache() {
  eventStore.refresh();
}

export function useScheduleEvents() {
  useEffect(() => {
    eventStore.ensureHydrated();
  }, []);

  const events = useSyncExternalStore(
    eventStore.subscribe,
    eventStore.getSnapshot,
    eventStore.getServerSnapshot
  );
  const loaded = useSyncExternalStore(
    eventStore.subscribe,
    eventStore.getHydratedSnapshot,
    eventStore.getServerHydratedSnapshot
  );

  const addEvent = useCallback((event: Omit<ScheduleEvent, "id">) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    eventStore.mutate(
      (cur) => sortEvents([...cur, { ...event, id: tempId }]),
      () => fetch("/api/events", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(event) }),
      { action: "add" }
    );
  }, []);

  // `id` may be a virtual recurring-occurrence id (`realId::date`) — the API
  // resolves it back to the real stored event, so acting on any occurrence
  // acts on the whole series.
  const removeEvent = useCallback((id: string) => {
    const realId = baseEventId(id);
    eventStore.mutate(
      (cur) => cur.filter((event) => event.id !== realId),
      () => fetch(`/api/events/${realId}`, { method: "DELETE" }),
      { action: "delete" }
    );
  }, []);

  // Re-inserts a previously-removed event with its original id intact, for undo.
  const restoreEvent = useCallback((event: ScheduleEvent) => {
    eventStore.mutate(
      (cur) => sortEvents([...cur.filter((e) => e.id !== event.id), event]),
      () => fetch("/api/events", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(event) }),
      { action: "restore" }
    );
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
      eventStore.mutate(
        (cur) => sortEvents(cur.map((event) => (event.id === realId ? { ...event, ...changes } : event))),
        () =>
          fetch(`/api/events/${realId}`, {
            method: "PATCH",
            headers: JSON_HEADERS,
            body: JSON.stringify(changes),
          }),
        { action: "update" }
      );
    },
    []
  );

  return { events, loaded, addEvent, removeEvent, restoreEvent, updateEvent };
}
