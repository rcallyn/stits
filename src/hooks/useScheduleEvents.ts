"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { baseEventId, ScheduleEvent, sortEvents, todayISODate } from "@/lib/schedule";
import { pushToast } from "@/lib/toast";
import { createEntityStore } from "@/lib/createEntityStore";
import { ALL_TIME, covers, DateWindow, defaultWindow, eventsUrl, widenWindow } from "@/lib/eventWindow";

const JSON_HEADERS = { "Content-Type": "application/json" };

// Only this date window is fetched; ensureEventRange() widens it on demand.
let eventWindow: DateWindow = defaultWindow(todayISODate());

export const eventStore = createEntityStore<ScheduleEvent>({
  endpoint: () => eventsUrl(eventWindow),
  fromResponse: (data) => sortEvents((data as { events?: ScheduleEvent[] }).events ?? []),
  noun: "event",
  offlineKey: "events",
});

/** Make sure events overlapping [from, to] are loaded, fetching more if the window falls short. */
export function ensureEventRange(from: string, to: string) {
  if (covers(eventWindow, from, to)) return;
  eventWindow = widenWindow(eventWindow, from, to);
  eventStore.refresh();
}

/** Load the whole history (for search). */
export function ensureAllEvents() {
  if (eventWindow === ALL_TIME) return;
  eventWindow = ALL_TIME;
  eventStore.refresh();
}

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

  // Re-inserts a previously-removed event, for undo. The server assigns a new
  // id; the optimistic copy keeps the old one until the refetch swaps it.
  const restoreEvent = useCallback((event: ScheduleEvent) => {
    eventStore.mutate(
      (cur) => sortEvents([...cur.filter((e) => e.id !== event.id), event]),
      () => fetch("/api/events", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(event) }),
      { action: "restore" }
    );
  }, []);

  // `id` may be a virtual recurring-occurrence id (`realId::date`) — the API
  // resolves it back to the real stored event, so acting on any occurrence
  // acts on the whole series. Offers an Undo toast unless `offerUndo` is false
  // (e.g. when the event was merged into another and restoring would duplicate).
  const removeEvent = useCallback(
    (id: string, offerUndo = true) => {
      const realId = baseEventId(id);
      const removed = eventStore.getAll().find((event) => event.id === realId);
      eventStore.mutate(
        (cur) => cur.filter((event) => event.id !== realId),
        () => fetch(`/api/events/${realId}`, { method: "DELETE" }),
        { action: "delete" }
      );
      if (removed && offerUndo) {
        pushToast(`Deleted “${removed.title}”.`, "info", 8000, {
          label: "Undo",
          run: () => restoreEvent(removed),
        });
      }
    },
    [restoreEvent]
  );

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
