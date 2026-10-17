import { ScheduleEvent, scheduleEventKind } from "@/lib/schedule";
import { resolveColor } from "@/lib/itemColor";
import { blockClassFor } from "./geometry";
import { DayCalendarProps } from "./types";

type Props = Pick<
  DayCalendarProps,
  "date" | "events" | "onEditEvent" | "isEventDone" | "onToggleDone" | "onPlaceAllDay" | "onPlaceOnEvent" | "categoryColors"
> & {
  draggable: boolean;
  placing: boolean;
  highlighted: boolean;
  onPointerDown: (event: ScheduleEvent, e: React.PointerEvent) => void;
};

/** The strip above the grid for untimed events; also the drop target for "make this all-day". */
export default function AllDayRow({
  date,
  events: allDay,
  draggable,
  placing,
  highlighted,
  onEditEvent,
  isEventDone,
  onToggleDone,
  onPlaceAllDay,
  onPlaceOnEvent,
  onPointerDown,
  categoryColors,
}: Props) {
  return (
    <div
      data-drop-zone="allday"
      data-drop-date={date}
      onClick={() => placing && onPlaceAllDay?.()}
      className={`flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-dashed px-2 py-1.5 transition-colors ${
        placing ? "cursor-crosshair" : ""
      } ${
        highlighted
          ? "border-black/[.3] bg-black/[.03] dark:border-white/[.4] dark:bg-white/[.05]"
          : "border-transparent"
      }`}
    >
      {allDay.length === 0 ? (
        <span className="text-[11px] text-zinc-400">
          {placing ? "Click to attach the note here (all day)" : "All day"}
        </span>
      ) : (
        allDay.map((event) => {
          const interactive = draggable || Boolean(onEditEvent);
          const color = resolveColor(event.todoId ?? event.id, event.category, categoryColors);
          const kind = scheduleEventKind(event);
          const done = isEventDone?.(event) ?? false;
          return (
            <div
              key={event.id}
              onPointerDown={(e) => !placing && interactive && onPointerDown(event, e)}
              onClick={(e) => {
                if (!placing) return;
                e.stopPropagation();
                onPlaceOnEvent?.(event);
              }}
              style={{ touchAction: draggable ? "none" : undefined }}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium select-none ${blockClassFor(
                kind,
                color
              )} ${kind === "note" ? "rounded-md" : "rounded-full"} ${
                placing ? "cursor-crosshair" : interactive ? "cursor-pointer" : "cursor-default"
              } ${draggable && !placing ? "active:cursor-grabbing" : ""}`}
            >
              {kind === "todo" && onToggleDone && (
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => onToggleDone(event)}
                  style={{ pointerEvents: placing ? "none" : undefined }}
                  onPointerDown={(e) => !placing && e.stopPropagation()}
                  onClick={(e) => !placing && e.stopPropagation()}
                  aria-label={done ? `Mark ${event.title} not done` : `Mark ${event.title} done`}
                  className="h-3 w-3 shrink-0 cursor-pointer"
                />
              )}
              <span className={done ? "line-through opacity-70" : ""}>
                {event.isRecurringInstance && "↻ "}
                {event.title}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
