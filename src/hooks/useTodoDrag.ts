"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Todo } from "@/lib/todos";

// Drags a todo from a list onto the Dashboard calendar, using Pointer Events
// (not the HTML5 Drag and Drop API) so the exact same code path works for
// mouse, touch, and pen — HTML5 DnD has no touch equivalent at all, which is
// why every other drag interaction in this app that needed to work on mobile
// (DayCalendar's own event move/resize) was already built this way instead.
//
// Drop targets are plain elements carrying data attributes — no new DOM
// structure, no per-component wiring beyond adding attributes to elements
// WeekCalendar/DayCalendar already render:
//   data-drop-zone="allday" data-drop-date="<YYYY-MM-DD>"
//   data-drop-zone="timed"  data-drop-date="<YYYY-MM-DD>"
//     data-drop-start="<minutes>" data-drop-end="<minutes>"
// For a timed zone, the exact drop minute is derived from where within the
// element's own box the pointer let go — start + fraction-of-height *
// (end - start), snapped to 15 minutes — so one formula works for both
// WeekCalendar's per-day columns and DayCalendar's single grid without
// either needing to expose its internal layout.

export type DropZone =
  | { kind: "allday"; date: string }
  | { kind: "timed"; date: string; minutes: number };

type DragState = { todo: Todo; x: number; y: number } | null;

// Below this many px of movement, a pointerdown/up counts as a tap (so
// clicking a todo to open its edit modal still works) rather than a drag —
// same threshold DayCalendar's own pointer-drag engine uses.
const MOVE_THRESHOLD = 4;

let pendingStart: { todo: Todo; x: number; y: number } | null = null;
let state: DragState = null;
const listeners = new Set<() => void>();
let onDrop: ((todo: Todo, zone: DropZone) => void) | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function snapToQuarterHour(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

function zoneAt(x: number, y: number): DropZone | null {
  const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>(
    "[data-drop-zone]"
  );
  const date = el?.dataset.dropDate;
  if (!el || !date) return null;

  if (el.dataset.dropZone === "allday") return { kind: "allday", date };

  const start = Number(el.dataset.dropStart);
  const end = Number(el.dataset.dropEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const rect = el.getBoundingClientRect();
  const fraction = rect.height > 0 ? (y - rect.top) / rect.height : 0;
  const raw = start + fraction * (end - start);
  const minutes = Math.max(start, Math.min(end - 15, snapToQuarterHour(raw)));
  return { kind: "timed", date, minutes };
}

function handlePointerMove(e: PointerEvent) {
  if (state) {
    state = { ...state, x: e.clientX, y: e.clientY };
    emit();
    return;
  }
  if (!pendingStart) return;
  const dx = e.clientX - pendingStart.x;
  const dy = e.clientY - pendingStart.y;
  if (Math.hypot(dx, dy) <= MOVE_THRESHOLD) return;
  state = { todo: pendingStart.todo, x: e.clientX, y: e.clientY };
  emit();
}

function handlePointerUp(e: PointerEvent) {
  pendingStart = null;
  if (!state) return;
  const { todo } = state;
  const zone = zoneAt(e.clientX, e.clientY);
  state = null;
  emit();
  if (zone) onDrop?.(todo, zone);
}

let listenersAttached = false;
function ensureListeners() {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
}

/**
 * Call from a todo row's onPointerDown. Doesn't call preventDefault/
 * stopPropagation — nothing visibly starts until the pointer actually moves
 * past MOVE_THRESHOLD, so a plain tap still reaches the row's own onClick
 * (e.g. opening the edit modal) completely normally.
 */
export function startTodoDrag(todo: Todo, e: { clientX: number; clientY: number }) {
  ensureListeners();
  pendingStart = { todo, x: e.clientX, y: e.clientY };
}

function subscribe(listener: () => void) {
  ensureListeners();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): DragState {
  return state;
}
function getServerSnapshot(): DragState {
  return null;
}

/** Live drag state — which todo (if any) is being dragged, and where. */
export function useTodoDragState(): DragState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The drop zone currently under the pointer, if a todo is being dragged. */
export function useHoveredDropZone(): DropZone | null {
  const drag = useTodoDragState();
  return useMemo(() => {
    if (!drag || typeof document === "undefined") return null;
    return zoneAt(drag.x, drag.y);
  }, [drag]);
}

/** Registered once by whichever component owns scheduling (the Dashboard). */
export function useTodoDropHandler(handler: (todo: Todo, zone: DropZone) => void) {
  useEffect(() => {
    onDrop = handler;
    return () => {
      if (onDrop === handler) onDrop = null;
    };
  }, [handler]);
}
