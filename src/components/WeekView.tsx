import { Category } from "@/lib/categories";
import { resolveColor } from "@/lib/itemColor";
import { weekDates } from "@/lib/monthGrid";
import {
  expandRecurringEvents,
  formatEventTime,
  isEventOnDate,
  ScheduleEvent,
  scheduleEventKind,
  todayISODate,
} from "@/lib/schedule";

type Props = {
  selectedDate: string;
  events: ScheduleEvent[];
  categoryColors?: Partial<Record<Category, string>>;
  onSelectDay: (date: string) => void;
};

export default function WeekView({ selectedDate, events, categoryColors, onSelectDay }: Props) {
  const days = weekDates(selectedDate);
  const today = todayISODate();
  const expanded = expandRecurringEvents(events, days[0], days[days.length - 1]);

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((date) => {
        const [y, m, d] = date.split("-").map(Number);
        const weekday = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short" });
        const dayEvents = expanded
          .filter((e) => isEventOnDate(e, date))
          .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        const isToday = date === today;
        const isSelected = date === selectedDate;

        return (
          <div key={date} className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => onSelectDay(date)}
              className={`flex flex-col items-center rounded-lg py-1.5 transition-colors ${
                isSelected
                  ? "bg-foreground text-background"
                  : "hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              }`}
            >
              <span className="text-[10px] font-medium uppercase opacity-70">{weekday}</span>
              <span
                className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                  isToday && !isSelected ? "bg-[#007AFF] font-semibold text-white" : ""
                }`}
              >
                {d}
              </span>
            </button>
            <div className="flex min-h-16 flex-col gap-1">
              {dayEvents.slice(0, 4).map((event) => {
                const kind = scheduleEventKind(event);
                const color = resolveColor(event.todoId ?? event.id, event.category, categoryColors);
                const fill = kind === "note" ? color.soft : kind === "todo" ? color.strong : color.solid;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelectDay(date)}
                    title={event.title}
                    className={`truncate rounded px-1.5 py-1 text-left text-[11px] leading-tight ${fill}`}
                  >
                    {event.time && <span className="opacity-80">{formatEventTime(event.time)} </span>}
                    {event.title}
                  </button>
                );
              })}
              {dayEvents.length > 4 && (
                <span className="px-1.5 text-[10px] text-zinc-400">+{dayEvents.length - 4} more</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
