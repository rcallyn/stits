"use client";

import { useCallback, useEffect, useState } from "react";
import { SCHEDULE_STORAGE_KEY, ScheduleEvent, sortEvents } from "@/lib/schedule";

export function useScheduleEvents() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (raw) {
      try {
        setEvents(sortEvents(JSON.parse(raw)));
      } catch {
        setEvents([]);
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(events));
    }
  }, [events, loaded]);

  const addEvent = useCallback((event: Omit<ScheduleEvent, "id">) => {
    setEvents((prev) =>
      sortEvents([...prev, { ...event, id: crypto.randomUUID() }])
    );
  }, []);

  const removeEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== id));
  }, []);

  const updateEvent = useCallback(
    (id: string, changes: Partial<Pick<ScheduleEvent, "date" | "time" | "endTime">>) => {
      setEvents((prev) =>
        sortEvents(
          prev.map((event) => (event.id === id ? { ...event, ...changes } : event))
        )
      );
    },
    []
  );

  return { events, loaded, addEvent, removeEvent, updateEvent };
}
