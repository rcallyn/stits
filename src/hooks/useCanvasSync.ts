"use client";

import { useCallback, useState } from "react";
import { useTodos } from "@/hooks/useTodos";
import { useScheduleEvents } from "@/hooks/useScheduleEvents";
import { CanvasSettings, useCanvasSettings } from "@/hooks/useCanvasSettings";
import { shiftISODate, todayISODate } from "@/lib/schedule";
import { IcsPlannerItem } from "@/lib/ics";

// The feed itself isn't queried by date range (Canvas doesn't support that
// for ICS), so this window only bounds which previously-synced items are
// eligible for removal when they no longer appear in a fresh fetch.
const SYNC_DAYS_BACK = 14;
const SYNC_DAYS_FORWARD = 120;

function isoToLocalDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso; // already a plain date (all-day) — avoid a UTC-midnight round-trip shifting it a day
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoToLocalTime(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export type CanvasSyncResult = { added: number; updated: number; removed: number };

export function useCanvasSync() {
  const { todos, addTodo, updateTodo, removeTodo } = useTodos();
  const { events, addEvent, updateEvent, removeEvent } = useScheduleEvents();
  const { settings, updateSettings } = useCanvasSettings();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CanvasSyncResult | null>(null);

  // Accepts an override so a caller that just persisted a new feed URL (e.g.
  // on blur, immediately followed by clicking Sync) doesn't read this hook's
  // `settings` before React has re-rendered with the fresh value — updating
  // the external store is synchronous, but this callback's closure isn't.
  const sync = useCallback(
    async (override?: Partial<CanvasSettings>) => {
      const effective = { ...settings, ...override };
      if (!effective.feedUrl.trim()) {
        setError("Add your Canvas calendar feed URL first.");
        return;
      }
      setSyncing(true);
      setError(null);
      try {
        const res = await fetch("/api/canvas-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedUrl: effective.feedUrl }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Sync failed.");
          return;
        }

        const items: IcsPlannerItem[] = data.items ?? [];
        const seenIds = new Set(items.map((item) => item.canvasId));
        let added = 0;
        let updated = 0;

        for (const item of items) {
          if (item.kind === "todo") {
            const dueDate = isoToLocalDate(item.dueAtISO);
            const existing = todos.find((t) => t.canvasId === item.canvasId);
            if (existing) {
              updateTodo(existing.id, { title: item.title, dueDate, category: "school" });
              updated++;
            } else {
              addTodo({ title: item.title, dueDate, category: "school", canvasId: item.canvasId });
              added++;
            }
          } else {
            const date = isoToLocalDate(item.startAtISO);
            const time = item.allDay ? "" : isoToLocalTime(item.startAtISO);
            const endTime = !item.allDay && item.endAtISO ? isoToLocalTime(item.endAtISO) : undefined;
            const existing = events.find((e) => e.canvasId === item.canvasId);
            if (existing) {
              updateEvent(existing.id, { title: item.title, date, time, endTime });
              updated++;
            } else {
              addEvent({ title: item.title, date, time, endTime, category: "school", canvasId: item.canvasId });
              added++;
            }
          }
        }

        // Anything previously synced from Canvas, due/scheduled inside this
        // window, but no longer returned has been removed or completed on
        // Canvas's side — drop it here too. Items outside the window are
        // left alone since this fetch says nothing about their current state.
        const startDate = shiftISODate(todayISODate(), -SYNC_DAYS_BACK);
        const endDate = shiftISODate(todayISODate(), SYNC_DAYS_FORWARD);
        let removed = 0;
        for (const todo of todos) {
          if (!todo.canvasId || seenIds.has(todo.canvasId)) continue;
          if (todo.dueDate && (todo.dueDate < startDate || todo.dueDate > endDate)) continue;
          removeTodo(todo.id);
          removed++;
        }
        for (const event of events) {
          if (!event.canvasId || seenIds.has(event.canvasId)) continue;
          if (event.date < startDate || event.date > endDate) continue;
          removeEvent(event.id);
          removed++;
        }

        updateSettings({ lastSyncedAt: new Date().toISOString() });
        setLastResult({ added, updated, removed });
      } catch {
        setError("Couldn't reach the server.");
      } finally {
        setSyncing(false);
      }
    },
    [
      settings,
      todos,
      events,
      addTodo,
      updateTodo,
      removeTodo,
      addEvent,
      updateEvent,
      removeEvent,
      updateSettings,
    ]
  );

  return { sync, syncing, error, lastResult };
}
