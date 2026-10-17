"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MIN_DURATION_MINUTES,
  PositionedEvent,
  ScheduleEvent,
  eventDurationMinutes,
  minutesToTime,
  scheduleEventKind,
  timeToMinutes,
} from "@/lib/schedule";
import { MOVE_THRESHOLD, PX_PER_MINUTE, SNAP_MINUTES, minutesFromClientY } from "./geometry";
import { ClickTarget, DayCalendarProps, DragMode, DragState, EditingNote, EventDraft } from "./types";

type Args = Pick<DayCalendarProps, "events" | "onUpdateEvent" | "onEditEvent" | "onMergeNoteEvent" | "placementActive"> & {
  positioned: PositionedEvent[];
  rangeStartMinutes: number;
  rangeEndMinutes: number;
};

/**
 * Pointer-driven drag/resize/click handling for one day's grid. Window-level
 * pointermove/up listeners are installed once and read everything through
 * refs, so a drag in progress survives re-renders. Preview state (draft times,
 * drop line, highlights) is exposed for rendering; commits go out through the
 * onUpdateEvent / onEditEvent / onMergeNoteEvent callbacks.
 */
export function useDayDrag({
  events,
  positioned,
  rangeStartMinutes,
  rangeEndMinutes,
  placementActive,
  onUpdateEvent,
  onEditEvent,
  onMergeNoteEvent,
}: Args) {
  const [draft, setDraft] = useState<Record<string, EventDraft>>({});
  const [dropPreviewMinutes, setDropPreviewMinutes] = useState<number | null>(null);
  const [allDayHighlight, setAllDayHighlight] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<EditingNote | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const draftRef = useRef<Record<string, { time: string; endTime: string }>>({});
  const gridRef = useRef<HTMLDivElement>(null);
  const onUpdateEventRef = useRef(onUpdateEvent);
  const onEditEventRef = useRef(onEditEvent);
  const onMergeNoteEventRef = useRef(onMergeNoteEvent);
  const eventsRef = useRef(events);
  const positionedRef = useRef(positioned);
  const rangeRef = useRef({ start: rangeStartMinutes, end: rangeEndMinutes });

  useEffect(() => {
    onUpdateEventRef.current = onUpdateEvent;
  }, [onUpdateEvent]);

  useEffect(() => {
    onEditEventRef.current = onEditEvent;
  }, [onEditEvent]);

  useEffect(() => {
    onMergeNoteEventRef.current = onMergeNoteEvent;
  }, [onMergeNoteEvent]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    positionedRef.current = positioned;
  }, [positioned]);

  useEffect(() => {
    rangeRef.current = { start: rangeStartMinutes, end: rangeEndMinutes };
  }, [rangeStartMinutes, rangeEndMinutes]);

  useEffect(() => {
    function findMergeTarget(pointerY: number, draggedId: string): string | null {
      for (const { event } of positionedRef.current) {
        if (event.id === draggedId) continue;
        if (scheduleEventKind(event) === "todo") continue;
        const start = timeToMinutes(event.time);
        const duration = eventDurationMinutes(event);
        const top = (start - rangeRef.current.start) * PX_PER_MINUTE;
        const height = Math.max(duration * PX_PER_MINUTE, 18);
        if (pointerY >= top && pointerY <= top + height) return event.id;
      }
      return null;
    }

    function handlePointerMove(e: PointerEvent) {
      const state = dragStateRef.current;
      if (!state) return;

      const deltaY = e.clientY - state.startY;
      if (!state.moved && Math.abs(deltaY) > MOVE_THRESHOLD) {
        state.moved = true;
      }

      // Recurring occurrences are virtual — moving/resizing one doesn't map
      // to a single stored event, so dragging is a no-op; a stationary click
      // still reaches pointerup below and opens the edit modal for the series.
      if (state.locked) return;

      if (state.origin === "allday") {
        if (e.clientY >= state.gridTop) {
          const minutes = minutesFromClientY(
            e.clientY,
            state.gridTop,
            rangeRef.current.start,
            rangeRef.current.end
          );
          state.previewMinutes = minutes;
          setDropPreviewMinutes(minutes);
        } else {
          state.previewMinutes = null;
          setDropPreviewMinutes(null);
        }
        return;
      }

      // origin === "grid"
      if (state.mode === "move" && e.clientY < state.gridTop) {
        state.overAllDay = true;
        setAllDayHighlight(true);
        if (state.mergeTargetId) {
          state.mergeTargetId = null;
          setMergeTargetId(null);
        }
        if (draftRef.current[state.id]) {
          const rest = { ...draftRef.current };
          delete rest[state.id];
          draftRef.current = rest;
          setDraft(rest);
        }
        return;
      }
      state.overAllDay = false;
      setAllDayHighlight(false);

      if (state.mode === "move" && state.isNoteEvent) {
        const pointerY = e.clientY - state.gridTop;
        const targetId = findMergeTarget(pointerY, state.id);
        if (targetId !== state.mergeTargetId) {
          state.mergeTargetId = targetId;
          setMergeTargetId(targetId);
        }
      }

      const rawDeltaMinutes = deltaY / PX_PER_MINUTE;
      const deltaMinutes = Math.round(rawDeltaMinutes / SNAP_MINUTES) * SNAP_MINUTES;

      let newStart = state.startMinutes;
      let newEnd = state.endMinutes;

      if (state.mode === "move") {
        newStart = Math.max(
          state.boundsMin,
          Math.min(state.startMinutes + deltaMinutes, state.boundsMax - state.durationMinutes)
        );
        newEnd = newStart + state.durationMinutes;
      } else if (state.mode === "resize-top") {
        newStart = Math.max(
          state.boundsMin,
          Math.min(state.startMinutes + deltaMinutes, state.endMinutes - MIN_DURATION_MINUTES)
        );
        newEnd = state.endMinutes;
      } else {
        newEnd = Math.min(
          state.boundsMax,
          Math.max(state.endMinutes + deltaMinutes, state.startMinutes + MIN_DURATION_MINUTES)
        );
        newStart = state.startMinutes;
      }

      draftRef.current = {
        ...draftRef.current,
        [state.id]: { time: minutesToTime(newStart), endTime: minutesToTime(newEnd) },
      };
      setDraft(draftRef.current);
    }

    function handlePointerUp() {
      const state = dragStateRef.current;
      if (!state) return;
      dragStateRef.current = null;
      setAllDayHighlight(false);

      if (state.origin === "allday") {
        const minutes = state.previewMinutes;
        setDropPreviewMinutes(null);
        if (minutes !== null) {
          onUpdateEventRef.current?.(state.id, {
            time: minutesToTime(minutes),
            endTime: minutesToTime(minutes + MIN_DURATION_MINUTES),
          });
        } else if (!state.moved) {
          const clicked = eventsRef.current.find((ev) => ev.id === state.id);
          if (clicked) onEditEventRef.current?.(clicked);
        }
        return;
      }

      // origin === "grid"
      if (state.overAllDay) {
        onUpdateEventRef.current?.(state.id, { time: "", endTime: "" });
        return;
      }

      if (state.isNoteEvent && state.mergeTargetId) {
        const targetId = state.mergeTargetId;
        setMergeTargetId(null);
        const rest = { ...draftRef.current };
        delete rest[state.id];
        draftRef.current = rest;
        setDraft(rest);

        const source = eventsRef.current.find((ev) => ev.id === state.id);
        const target = eventsRef.current.find((ev) => ev.id === targetId);
        if (source && target) onMergeNoteEventRef.current?.(source, target);
        return;
      }

      const value = draftRef.current[state.id];
      const rest = { ...draftRef.current };
      delete rest[state.id];
      draftRef.current = rest;
      setDraft(rest);

      if (value) {
        onUpdateEventRef.current?.(state.id, value);
      } else if (!state.moved && state.mode === "move") {
        const clicked = eventsRef.current.find((ev) => ev.id === state.id);
        if (!clicked) {
          // no-op
        } else if (state.clickTarget?.kind === "note") {
          setEditingNote({ eventId: clicked.id, lineId: state.clickTarget.lineId });
        } else if (state.clickTarget?.kind === "newNote") {
          setEditingNote({ eventId: clicked.id, lineId: "new" });
        } else {
          onEditEventRef.current?.(clicked);
        }
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: ScheduleEvent, mode: DragMode, e: React.PointerEvent, clickTarget: ClickTarget | null = null) => {
      if (placementActive) return;
      if (!onUpdateEventRef.current && !onEditEventRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const startMinutes = timeToMinutes(event.time);
      const endMinutes = startMinutes + eventDurationMinutes(event);
      const gridTop = gridRef.current?.getBoundingClientRect().top ?? 0;

      dragStateRef.current = {
        id: event.id,
        mode,
        origin: "grid",
        startY: e.clientY,
        startMinutes,
        endMinutes,
        durationMinutes: endMinutes - startMinutes,
        boundsMin: rangeStartMinutes,
        boundsMax: rangeEndMinutes,
        moved: false,
        gridTop,
        overAllDay: false,
        previewMinutes: null,
        isNoteEvent: Boolean(event.isNoteEvent),
        mergeTargetId: null,
        clickTarget,
        locked: Boolean(event.isRecurringInstance),
      };
    },
    [rangeStartMinutes, rangeEndMinutes, placementActive]
  );

  const handleAllDayPointerDown = useCallback(
    (event: ScheduleEvent, e: React.PointerEvent) => {
      if (placementActive) return;
      if (!onUpdateEventRef.current && !onEditEventRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const gridTop = gridRef.current?.getBoundingClientRect().top ?? 0;

      dragStateRef.current = {
        id: event.id,
        mode: "move",
        origin: "allday",
        startY: e.clientY,
        startMinutes: 0,
        endMinutes: 0,
        durationMinutes: MIN_DURATION_MINUTES,
        boundsMin: rangeStartMinutes,
        boundsMax: rangeEndMinutes,
        moved: false,
        gridTop,
        overAllDay: false,
        previewMinutes: null,
        isNoteEvent: Boolean(event.isNoteEvent),
        mergeTargetId: null,
        clickTarget: null,
        locked: Boolean(event.isRecurringInstance),
      };
    },
    [rangeStartMinutes, rangeEndMinutes, placementActive]
  );

  return {
    gridRef,
    draft,
    dropPreviewMinutes,
    allDayHighlight,
    mergeTargetId,
    editingNote,
    setEditingNote,
    handlePointerDown,
    handleAllDayPointerDown,
  };
}
