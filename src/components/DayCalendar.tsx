"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MIN_DURATION_MINUTES,
  ScheduleEvent,
  eventDurationMinutes,
  formatEventTime,
  minutesToTime,
  timeToMinutes,
} from "@/lib/schedule";
import { resolveColor } from "@/lib/itemColor";

const MOVE_THRESHOLD = 4; // px, below this a pointer down/up counts as a click

const HOUR_HEIGHT = 48; // px
const PX_PER_MINUTE = HOUR_HEIGHT / 60;
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 21;
const GUTTER_WIDTH = 44; // px
const SNAP_MINUTES = 15;

type Props = {
  events: ScheduleEvent[];
  onUpdateEvent?: (id: string, changes: { time: string; endTime: string }) => void;
  onEditEvent?: (event: ScheduleEvent) => void;
  onDropExternal?: (dataTransfer: DataTransfer, time: string) => void;
};

type PositionedEvent = {
  event: ScheduleEvent;
  column: number;
  columns: number;
};

type DragMode = "move" | "resize-top" | "resize-bottom";
type DragOrigin = "grid" | "allday";

type DragState = {
  id: string;
  mode: DragMode;
  origin: DragOrigin;
  startY: number;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  boundsMin: number;
  boundsMax: number;
  moved: boolean;
  gridTop: number;
  overAllDay: boolean;
  previewMinutes: number | null;
};

export default function DayCalendar({ events, onUpdateEvent, onEditEvent, onDropExternal }: Props) {
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
  const [dropPreviewMinutes, setDropPreviewMinutes] = useState<number | null>(null);
  const [allDayHighlight, setAllDayHighlight] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const draftRef = useRef<Record<string, { time: string; endTime: string }>>({});
  const gridRef = useRef<HTMLDivElement>(null);
  const onUpdateEventRef = useRef(onUpdateEvent);
  const onEditEventRef = useRef(onEditEvent);
  const eventsRef = useRef(events);
  const rangeRef = useRef({ start: rangeStartMinutes, end: rangeEndMinutes });

  useEffect(() => {
    onUpdateEventRef.current = onUpdateEvent;
  }, [onUpdateEvent]);

  useEffect(() => {
    onEditEventRef.current = onEditEvent;
  }, [onEditEvent]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    rangeRef.current = { start: rangeStartMinutes, end: rangeEndMinutes };
  }, [rangeStartMinutes, rangeEndMinutes]);

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      const state = dragStateRef.current;
      if (!state) return;

      const deltaY = e.clientY - state.startY;
      if (!state.moved && Math.abs(deltaY) > MOVE_THRESHOLD) {
        state.moved = true;
      }

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

      const value = draftRef.current[state.id];
      const rest = { ...draftRef.current };
      delete rest[state.id];
      draftRef.current = rest;
      setDraft(rest);

      if (value) {
        onUpdateEventRef.current?.(state.id, value);
      } else if (!state.moved && state.mode === "move") {
        const clicked = eventsRef.current.find((ev) => ev.id === state.id);
        if (clicked) onEditEventRef.current?.(clicked);
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
      };
    },
    [rangeStartMinutes, rangeEndMinutes]
  );

  const handleAllDayPointerDown = useCallback(
    (event: ScheduleEvent, e: React.PointerEvent) => {
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
      };
    },
    [rangeStartMinutes, rangeEndMinutes]
  );

  function minutesFromPointerY(clientY: number, top: number) {
    return minutesFromClientY(clientY, top, rangeStartMinutes, rangeEndMinutes);
  }

  function handleGridDragOver(e: React.DragEvent) {
    if (!onDropExternal) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    const rect = e.currentTarget.getBoundingClientRect();
    setDropPreviewMinutes(minutesFromPointerY(e.clientY, rect.top));
  }

  function handleGridDrop(e: React.DragEvent) {
    if (!onDropExternal) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = minutesFromPointerY(e.clientY, rect.top);
    setDropPreviewMinutes(null);
    onDropExternal(e.dataTransfer, minutesToTime(minutes));
  }

  const draggable = Boolean(onUpdateEvent);
  const showAllDayRow = allDay.length > 0 || draggable;

  return (
    <div className="flex flex-col gap-3">
      {showAllDayRow && (
        <div
          className={`flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-dashed px-2 py-1.5 transition-colors ${
            allDayHighlight
              ? "border-black/[.3] bg-black/[.03] dark:border-white/[.4] dark:bg-white/[.05]"
              : "border-transparent"
          }`}
        >
          {allDay.length === 0 ? (
            <span className="text-[11px] text-zinc-400">All day</span>
          ) : (
            allDay.map((event) => {
              const interactive = draggable || Boolean(onEditEvent);
              const color = resolveColor(event.todoId ?? event.id, event.category);
              return (
                <div
                  key={event.id}
                  onPointerDown={(e) => interactive && handleAllDayPointerDown(event, e)}
                  style={{ touchAction: draggable ? "none" : undefined }}
                  className={`rounded-full px-3 py-1 text-xs font-medium select-none ${color.block} ${
                    interactive ? "cursor-pointer" : "cursor-default"
                  } ${draggable ? "active:cursor-grabbing" : ""}`}
                >
                  {event.title}
                </div>
              );
            })
          )}
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
          ref={gridRef}
          className="relative flex-1 border-l border-black/[.08] dark:border-white/[.145]"
          style={{ height: totalHeight }}
          onDragOver={handleGridDragOver}
          onDragLeave={() => setDropPreviewMinutes(null)}
          onDrop={handleGridDrop}
        >
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-black/[.06] dark:border-white/[.08]"
              style={{ top: (hour - startHour) * HOUR_HEIGHT }}
            />
          ))}

          {dropPreviewMinutes !== null && (
            <div
              className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
              style={{ top: (dropPreviewMinutes - rangeStartMinutes) * PX_PER_MINUTE }}
            >
              <div className="h-0.5 flex-1 bg-foreground" />
              <span className="ml-1 shrink-0 rounded bg-foreground px-1 text-[10px] font-medium text-background">
                {formatEventTime(minutesToTime(dropPreviewMinutes))}
              </span>
            </div>
          )}

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
            const interactive = draggable || Boolean(onEditEvent);
            const color = resolveColor(event.todoId ?? event.id, event.category);

            return (
              <div
                key={event.id}
                className={`absolute overflow-hidden rounded-md px-2 py-1 ${color.block} ${
                  isDragging ? "z-10 shadow-lg ring-2 ring-background/50" : ""
                } ${interactive ? "cursor-pointer select-none" : ""} ${
                  draggable ? "active:cursor-grabbing" : ""
                }`}
                style={{
                  top,
                  height,
                  left: `${widthPct * column}%`,
                  width: `calc(${widthPct}% - 4px)`,
                  touchAction: draggable ? "none" : undefined,
                }}
                onPointerDown={(e) =>
                  interactive && handlePointerDown(event, "move", e)
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

function minutesFromClientY(
  clientY: number,
  top: number,
  rangeStartMinutes: number,
  rangeEndMinutes: number
) {
  const offsetY = clientY - top;
  const rawMinutes = rangeStartMinutes + offsetY / PX_PER_MINUTE;
  const snapped = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  return Math.max(rangeStartMinutes, Math.min(rangeEndMinutes - MIN_DURATION_MINUTES, snapped));
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
