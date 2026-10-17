"use client";

import { layoutDayEvents, minutesToTime, formatEventTime } from "@/lib/schedule";
import { useHoveredDropZone } from "@/hooks/useTodoDrag";
import AllDayRow from "./dayCalendar/AllDayRow";
import EventBlock from "./dayCalendar/EventBlock";
import {
  GUTTER_WIDTH,
  HOUR_HEIGHT,
  PX_PER_MINUTE,
  formatHour,
  minutesFromClientY,
  visibleHourRange,
} from "./dayCalendar/geometry";
import { DayCalendarProps } from "./dayCalendar/types";
import { useDayDrag } from "./dayCalendar/useDayDrag";

export default function DayCalendar({
  date,
  events,
  onUpdateEvent,
  onEditEvent,
  isEventDone,
  onToggleDone,
  onDeleteEvent,
  placementActive,
  onPlaceAtTime,
  onPlaceAllDay,
  onPlaceOnEvent,
  onAddNoteLine,
  onEditNoteLine,
  onRemoveNoteLine,
  onMergeNoteEvent,
  categoryColors,
}: DayCalendarProps) {
  const timed = events.filter((e) => e.time);
  const allDay = events.filter((e) => !e.time);

  const { startHour, endHour } = visibleHourRange(timed);
  const rangeStartMinutes = startHour * 60;
  const rangeEndMinutes = endHour * 60;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const totalHeight = hours.length * HOUR_HEIGHT;
  const positioned = layoutDayEvents(timed);

  const hoveredZone = useHoveredDropZone();
  const externalPreviewMinutes =
    hoveredZone?.kind === "timed" && hoveredZone.date === date ? hoveredZone.minutes : null;
  const externalAllDayHighlight = hoveredZone?.kind === "allday" && hoveredZone.date === date;

  const {
    gridRef,
    draft,
    dropPreviewMinutes,
    allDayHighlight,
    mergeTargetId,
    editingNote,
    setEditingNote,
    handlePointerDown,
    handleAllDayPointerDown,
  } = useDayDrag({
    events,
    positioned,
    rangeStartMinutes,
    rangeEndMinutes,
    placementActive,
    onUpdateEvent,
    onEditEvent,
    onMergeNoteEvent,
  });

  function handleGridClick(e: React.MouseEvent) {
    if (!placementActive || !onPlaceAtTime) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onPlaceAtTime(
      minutesToTime(minutesFromClientY(e.clientY, rect.top, rangeStartMinutes, rangeEndMinutes))
    );
  }

  const draggable = Boolean(onUpdateEvent);
  const showAllDayRow = allDay.length > 0 || draggable || placementActive;
  const placing = Boolean(placementActive);
  const previewMinutes = dropPreviewMinutes ?? externalPreviewMinutes;

  return (
    <div className="flex flex-col gap-3">
      {showAllDayRow && (
        <AllDayRow
          date={date}
          events={allDay}
          draggable={draggable}
          placing={placing}
          highlighted={allDayHighlight || externalAllDayHighlight}
          onEditEvent={onEditEvent}
          isEventDone={isEventDone}
          onToggleDone={onToggleDone}
          onPlaceAllDay={onPlaceAllDay}
          onPlaceOnEvent={onPlaceOnEvent}
          onPointerDown={handleAllDayPointerDown}
          categoryColors={categoryColors}
        />
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
          data-drop-zone="timed"
          data-drop-date={date}
          data-drop-start={rangeStartMinutes}
          data-drop-end={rangeEndMinutes}
          className={`relative flex-1 border-l border-black/[.08] dark:border-white/[.145] ${
            placing ? "cursor-crosshair" : ""
          }`}
          style={{ height: totalHeight }}
          onClick={handleGridClick}
        >
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-black/[.06] dark:border-white/[.08]"
              style={{ top: (hour - startHour) * HOUR_HEIGHT }}
            />
          ))}

          {previewMinutes !== null && (
            <div
              className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
              style={{ top: (previewMinutes - rangeStartMinutes) * PX_PER_MINUTE }}
            >
              <div className="h-0.5 flex-1 bg-[#0071e3]" />
              <span className="ml-1 shrink-0 rounded bg-[#0071e3] px-1 text-[10px] font-medium text-white">
                {formatEventTime(minutesToTime(previewMinutes))}
              </span>
            </div>
          )}

          {positioned.map((p) => (
            <EventBlock
              key={p.event.id}
              positioned={p}
              rangeStartMinutes={rangeStartMinutes}
              draftValue={draft[p.event.id]}
              draggable={draggable}
              placing={placing}
              isMergeTarget={mergeTargetId === p.event.id}
              editingNote={editingNote}
              setEditingNote={setEditingNote}
              onPointerDown={handlePointerDown}
              onEditEvent={onEditEvent}
              isEventDone={isEventDone}
              onToggleDone={onToggleDone}
              onDeleteEvent={onDeleteEvent}
              onPlaceOnEvent={onPlaceOnEvent}
              onAddNoteLine={onAddNoteLine}
              onEditNoteLine={onEditNoteLine}
              onRemoveNoteLine={onRemoveNoteLine}
              categoryColors={categoryColors}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
