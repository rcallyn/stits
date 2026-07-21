"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MIN_DURATION_MINUTES,
  ScheduleEvent,
  eventDurationMinutes,
  minutesToTime,
  timeToMinutes,
} from "@/lib/schedule";

const HOUR_HEIGHT = 48; // px
const PX_PER_MINUTE = HOUR_HEIGHT / 60;
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 21;
const GUTTER_WIDTH = 44; // px
const SNAP_MINUTES = 15;

type Props = {
  events: ScheduleEvent[];
  onUpdateEvent?: (id: string, changes: { time: string; endTime: string }) => void;
};

type PositionedEvent = {
  event: ScheduleEvent;
  column: number;
  columns: number;
};

type DragMode = "move" | "resize-top" | "resize-bottom";

type DragState = {
  id: string;
  mode: DragMode;
  startY: number;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  boundsMin: number;
  boundsMax: number;
};

export default function DayCalendar({ events, onUpdateEvent }: Props) {
  const timed = events.filter((e) => e.time);
  const allDay = events.filter((e) => !e.time);

  const startHour = timed.length
    ? Math.min(DEFAULT_START_HOUR, ...timed.map((e) => Math.floor(timeToMinutes(e.time) / 60)))
    : DEFAULT_START_HOUR;
  const endHour = timed.length
    ? Math.max(
        DEFAULT_END_HOUR,
        ...timed.map((e) => Math.ceil((timeToMinutes(e.time) + eventDurationMinutes(e)) / 60))
      )
    : DEFAULT_END_HOUR;

  const rangeStartMinutes = startHour * 60;
  const rangeEndMinutes = endHour * 60;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const totalHeight = hours.length * HOUR_HEIGHT;
  const positioned = layoutEvents(timed);

  const [draft, setDraft] = useState<Record<string, { time: string; endTime: string }>>({});
  const dragStateRef = useRef<DragState | null>(null);
  const draftRef = useRef<Record<string, { time: string; endTime: string }>>({});
  const onUpdateEventRef = useRef(onUpdateEvent);

  useEffect(() => {
    onUpdateEventRef.current = onUpdateEvent;
  }, [onUpdateEvent]);

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      const state = dragStateRef.current;
      if (!state) return;

      const deltaY = e.clientY - state.startY;
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

      const value = draftRef.current[state.id];
      const rest = { ...draftRef.current };
      delete rest[state.id];
      draftRef.current = rest;
      setDraft(rest);

      if (value) {
        onUpdateEventRef.current?.(state.id, value);
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
    (event: ScheduleEvent, mode: DragMode, e: React.PointerEvent) => {
      if (!onUpdateEventRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const startMinutes = timeToMinutes(event.time);
      const endMinutes = startMinutes + eventDurationMinutes(event);

      dragStateRef.current = {
        id: event.id,
        mode,
        startY: e.clientY,
        startMinutes,
        endMinutes,
        durationMinutes: endMinutes - startMinutes,
        boundsMin: rangeStartMinutes,
        boundsMax: rangeEndMinutes,
      };
    },
    [rangeStartMinutes, rangeEndMinutes]
  );

  return (
    <div className="flex flex-col gap-3">
      {allDay.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allDay.map((event) => (
            <span
              key={event.id}
              className="rounded-full bg-black/[.06] px-3 py-1 text-xs font-medium dark:bg-white/[.1]"
            >
              {event.title}
            </span>
          ))}
        </div>
      )}

      <div className="flex">
        <div className="relative shrink-0" style={{ width: GUTTER_WIDTH, height: totalHeight }}>
          {hours.map((hour) => (
            <span
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[11px] text-zinc-400"
              style={{ top: (hour - startHour) * HOUR_HEIGHT }}
            >
              {formatHour(hour)}
            </span>
          ))}
        </div>

        <div
          className="relative flex-1 border-l border-black/[.08] dark:border-white/[.145]"
          style={{ height: totalHeight }}
        >
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-black/[.06] dark:border-white/[.08]"
              style={{ top: (hour - startHour) * HOUR_HEIGHT }}
            />
          ))}

          {positioned.map(({ event, column, columns }) => {
            const draftValue = draft[event.id];
            const time = draftValue?.time ?? event.time;
            const endTime = draftValue?.endTime ?? event.endTime;
            const start = timeToMinutes(time);
            const duration = endTime
              ? Math.max(timeToMinutes(endTime) - start, MIN_DURATION_MINUTES)
              : eventDurationMinutes(event);

            const top = (start - rangeStartMinutes) * PX_PER_MINUTE;
            const height = Math.max(duration * PX_PER_MINUTE, 18);
            const widthPct = 100 / columns;
            const isDragging = Boolean(draftValue);
            const draggable = Boolean(onUpdateEvent);

            return (
              <div
                key={event.id}
                className={`absolute overflow-hidden rounded-md bg-foreground/90 px-2 py-1 text-background ${
                  isDragging ? "z-10 shadow-lg ring-2 ring-background/50" : ""
                } ${draggable ? "cursor-grab select-none active:cursor-grabbing" : ""}`}
                style={{
                  top,
                  height,
                  left: `${widthPct * column}%`,
                  width: `calc(${widthPct}% - 4px)`,
                  touchAction: draggable ? "none" : undefined,
                }}
                onPointerDown={(e) =>
                  draggable && handlePointerDown(event, "move", e)
                }
              >
                <p className="truncate text-xs font-medium leading-tight">{event.title}</p>

                {draggable && (
                  <>
                    <div
                      className="absolute inset-x-0 top-0 h-2 cursor-ns-resize"
                      onPointerDown={(e) => handlePointerDown(event, "resize-top", e)}
                    />
                    <div
                      className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                      onPointerDown={(e) => handlePointerDown(event, "resize-bottom", e)}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatHour(hour: number) {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

function layoutEvents(events: ScheduleEvent[]): PositionedEvent[] {
  const sorted = [...events].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  const result: PositionedEvent[] = [];

  let cluster: ScheduleEvent[] = [];
  let clusterEnd = -Infinity;

  function flushCluster() {
    if (cluster.length === 0) return;
    const columnEndMinutes: number[] = [];
    const columnByEventId = new Map<string, number>();

    for (const event of cluster) {
      const start = timeToMinutes(event.time);
      let column = columnEndMinutes.findIndex((end) => end <= start);
      if (column === -1) {
        column = columnEndMinutes.length;
        columnEndMinutes.push(0);
      }
      columnEndMinutes[column] = start + eventDurationMinutes(event);
      columnByEventId.set(event.id, column);
    }

    const columns = columnEndMinutes.length;
    for (const event of cluster) {
      result.push({ event, column: columnByEventId.get(event.id)!, columns });
    }
    cluster = [];
  }

  for (const event of sorted) {
    const start = timeToMinutes(event.time);
    if (cluster.length > 0 && start >= clusterEnd) {
      flushCluster();
      clusterEnd = -Infinity;
    }
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, start + eventDurationMinutes(event));
  }
  flushCluster();

  return result;
}
