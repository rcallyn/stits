import { MIN_DURATION_MINUTES, PositionedEvent, ScheduleEvent, eventDurationMinutes, scheduleEventKind, timeToMinutes } from "@/lib/schedule";
import { resolveColor } from "@/lib/itemColor";
import { PX_PER_MINUTE, blockClassFor } from "./geometry";
import { ClickTarget, DayCalendarProps, DragMode, EditingNote, EventDraft } from "./types";

type Props = Pick<
  DayCalendarProps,
  | "onEditEvent"
  | "isEventDone"
  | "onToggleDone"
  | "onDeleteEvent"
  | "onPlaceOnEvent"
  | "onAddNoteLine"
  | "onEditNoteLine"
  | "onRemoveNoteLine"
  | "categoryColors"
> & {
  positioned: PositionedEvent;
  rangeStartMinutes: number;
  /** In-flight drag/resize times for this event, if it is being dragged. */
  draftValue: EventDraft | undefined;
  draggable: boolean;
  placing: boolean;
  isMergeTarget: boolean;
  editingNote: EditingNote | null;
  setEditingNote: (note: EditingNote | null) => void;
  onPointerDown: (event: ScheduleEvent, mode: DragMode, e: React.PointerEvent, clickTarget?: ClickTarget | null) => void;
};

/** One timed event on the grid: positioned block, inline note lines, resize handles, delete button. */
export default function EventBlock({
  positioned: { event, column, columns },
  rangeStartMinutes,
  draftValue,
  draggable,
  placing,
  isMergeTarget,
  editingNote,
  setEditingNote,
  onPointerDown: handlePointerDown,
  onEditEvent,
  isEventDone,
  onToggleDone,
  onDeleteEvent,
  onPlaceOnEvent,
  onAddNoteLine,
  onEditNoteLine,
  onRemoveNoteLine,
  categoryColors,
}: Props) {
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
  const color = resolveColor(event.todoId ?? event.id, event.category, categoryColors);
  const done = isEventDone?.(event) ?? false;
  const kind = scheduleEventKind(event);
  const notes = event.notes ?? [];
  const showNotesArea = notes.length > 0 || (!placing && Boolean(onAddNoteLine));

  return (
    <div
      key={event.id}
      className={`group absolute overflow-hidden px-2 py-1 ${blockClassFor(kind, color)} ${
        kind === "note" ? "rounded-sm" : "rounded-md"
      } ${isDragging ? "z-10 shadow-lg ring-2 ring-background/50" : ""} ${
        isMergeTarget ? "z-10 ring-2 ring-white" : ""
      } ${
        placing
          ? "cursor-crosshair"
          : interactive
            ? "cursor-pointer select-none"
            : ""
      } ${draggable && !placing ? "active:cursor-grabbing" : ""}`}
      style={{
        top,
        height,
        left: `${widthPct * column}%`,
        width: `calc(${widthPct}% - 4px)`,
        touchAction: draggable ? "none" : undefined,
      }}
      onPointerDown={(e) =>
        !placing && interactive && handlePointerDown(event, "move", e)
      }
      onClick={(e) => {
        if (!placing) return;
        e.stopPropagation();
        onPlaceOnEvent?.(event);
      }}
    >
      <div className="flex items-center gap-1">
        {kind === "todo" && onToggleDone && (
          <input
            type="checkbox"
            checked={done}
            onChange={() => onToggleDone(event)}
            style={{ pointerEvents: placing ? "none" : undefined }}
            onPointerDown={(e) => !placing && e.stopPropagation()}
            onClick={(e) => !placing && e.stopPropagation()}
            aria-label={done ? `Mark ${event.title} not done` : `Mark ${event.title} done`}
            className="relative z-20 h-3 w-3 shrink-0 cursor-pointer"
          />
        )}
        <p
          className={`truncate text-xs font-medium leading-tight ${
            done ? "line-through opacity-70" : ""
          }`}
        >
          {event.isRecurringInstance && "↻ "}
          {event.title}
        </p>
      </div>

      {showNotesArea && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {notes.map((note) =>
            !placing &&
            editingNote?.eventId === event.id &&
            editingNote?.lineId === note.id ? (
              <input
                key={note.id}
                autoFocus
                defaultValue={note.text}
                onBlur={(e) => {
                  onEditNoteLine?.(event, note.id, e.target.value);
                  setEditingNote(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingNote(null);
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full rounded bg-black/25 px-1 py-0.5 text-[10px] leading-tight text-white outline-none"
              />
            ) : (
              <div key={note.id} className="group/note flex items-center gap-1">
                {!placing && onRemoveNoteLine && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveNoteLine(event, note.id);
                    }}
                    aria-label="Remove note from this event"
                    title="Remove from this event"
                    className="flex h-2.5 w-2.5 shrink-0 items-center justify-center text-[9px] leading-none text-white/0 transition-opacity group-hover/note:text-white/70 hover:!text-white"
                  >
                    ✕
                  </button>
                )}
                <p
                  onPointerDown={(e) =>
                    !placing &&
                    interactive &&
                    handlePointerDown(event, "move", e, { kind: "note", lineId: note.id })
                  }
                  className={`min-w-0 flex-1 truncate text-[10px] leading-tight opacity-80 ${
                    !placing ? "cursor-text hover:opacity-100" : ""
                  }`}
                >
                  {note.text}
                </p>
              </div>
            )
          )}
          {!placing &&
            onAddNoteLine &&
            (editingNote?.eventId === event.id && editingNote?.lineId === "new" ? (
              <input
                autoFocus
                onBlur={(e) => {
                  onAddNoteLine(event, e.target.value);
                  setEditingNote(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingNote(null);
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Type a note…"
                className="w-full rounded bg-black/25 px-1 py-0.5 text-[10px] leading-tight text-white outline-none placeholder:text-white/50"
              />
            ) : (
              <div
                onPointerDown={(e) =>
                  interactive && handlePointerDown(event, "move", e, { kind: "newNote" })
                }
                className="h-2.5 cursor-text text-[9px] italic leading-tight text-white/0 group-hover:text-white/50"
              >
                + note
              </div>
            ))}
        </div>
      )}

      {draggable && !placing && (
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

      {onDeleteEvent && !placing && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteEvent(event);
          }}
          aria-label={`Remove ${event.title} from schedule`}
          title="Remove from schedule"
          className="absolute right-0.5 top-0.5 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/25 text-[9px] leading-none text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}
