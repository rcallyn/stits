import { ScheduleEvent } from "@/lib/schedule";
import { Category } from "@/lib/categories";

export type DayCalendarProps = {
  date: string;
  events: ScheduleEvent[];
  onUpdateEvent?: (id: string, changes: { time: string; endTime: string }) => void;
  onEditEvent?: (event: ScheduleEvent) => void;
  isEventDone?: (event: ScheduleEvent) => boolean;
  onToggleDone?: (event: ScheduleEvent) => void;
  onDeleteEvent?: (event: ScheduleEvent) => void;
  placementActive?: boolean;
  onPlaceAtTime?: (time: string) => void;
  onPlaceAllDay?: () => void;
  onPlaceOnEvent?: (event: ScheduleEvent) => void;
  onAddNoteLine?: (event: ScheduleEvent, text: string) => void;
  onEditNoteLine?: (event: ScheduleEvent, lineId: string, text: string) => void;
  onRemoveNoteLine?: (event: ScheduleEvent, lineId: string) => void;
  onMergeNoteEvent?: (source: ScheduleEvent, target: ScheduleEvent) => void;
  categoryColors?: Partial<Record<Category, string>>;
};

export type DragMode = "move" | "resize-top" | "resize-bottom";
export type DragOrigin = "grid" | "allday";
export type ClickTarget = { kind: "note"; lineId: string } | { kind: "newNote" };
export type EventDraft = { time: string; endTime: string };
export type EditingNote = { eventId: string; lineId: string };

export type DragState = {
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
  isNoteEvent: boolean;
  mergeTargetId: string | null;
  clickTarget: ClickTarget | null;
  locked: boolean;
};
