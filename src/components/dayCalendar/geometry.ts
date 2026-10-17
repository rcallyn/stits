import { MIN_DURATION_MINUTES, ScheduleEvent, ScheduleEventKind, eventDurationMinutes, timeToMinutes } from "@/lib/schedule";
import { ColorStyle } from "@/lib/itemColor";

export const MOVE_THRESHOLD = 4; // px, below this a pointer down/up counts as a click
export const HOUR_HEIGHT = 48; // px
export const PX_PER_MINUTE = HOUR_HEIGHT / 60;
export const DEFAULT_START_HOUR = 7;
export const DEFAULT_END_HOUR = 21;
export const GUTTER_WIDTH = 44; // px
export const SNAP_MINUTES = 15;

// Independent notes: 20% opaque body. Todos: 80% opaque body. Plain events:
// ~90% opaque. The opacity gradient — not an icon, border, or shape — is
// what tells the three kinds apart on the schedule.
export function blockClassFor(kind: ScheduleEventKind, color: ColorStyle): string {
  if (kind === "note") return color.soft;
  if (kind === "todo") return color.strong;
  return color.solid;
}

/** The hours the grid shows: 7am–9pm, widened to fit any event outside that. */
export function visibleHourRange(timed: ScheduleEvent[]): { startHour: number; endHour: number } {
  if (!timed.length) return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  return {
    startHour: Math.min(DEFAULT_START_HOUR, ...timed.map((e) => Math.floor(timeToMinutes(e.time) / 60))),
    endHour: Math.max(
      DEFAULT_END_HOUR,
      ...timed.map((e) => Math.ceil((timeToMinutes(e.time) + eventDurationMinutes(e)) / 60))
    ),
  };
}

/** Pointer Y -> minutes since midnight, snapped to SNAP_MINUTES and clamped to the grid. */
export function minutesFromClientY(
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

export function formatHour(hour: number) {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}
