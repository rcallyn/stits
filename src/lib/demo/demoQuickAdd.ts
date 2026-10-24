import type { ParsedItem } from "@/lib/quickAdd";
import { shiftISODate, todayISODate } from "@/lib/schedule";

// The demo can't call Claude (that would put the API bill in front of
// anonymous visitors), so quick add there uses this small rule-based parser
// instead. It covers the common shapes — "tomorrow", weekday names, "in 3
// days", "10/31", "at 3pm", "10–11am" — and anything with a time becomes an
// event, anything without one a todo, the same rule the real prompt uses.

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_PATTERN = "(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday)?";

function to24h(hour: number, minute: number, meridiem: string | undefined): string | null {
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseQuickAddOffline(input: string, today: string = todayISODate()): ParsedItem | null {
  let text = ` ${input.trim()} `;
  const take = (re: RegExp) => {
    const match = text.match(re);
    if (match) text = text.replace(re, " ");
    return match;
  };

  let date: string | undefined;
  let m: RegExpMatchArray | null;
  if ((m = take(/\s(?:on\s+|by\s+|due\s+)?(today|tonight)\b/i))) {
    date = today;
  } else if ((m = take(/\s(?:on\s+|by\s+|due\s+)?tomorrow\b/i))) {
    date = shiftISODate(today, 1);
  } else if ((m = take(/\sin\s+(\d{1,2})\s+(day|week)s?\b/i))) {
    date = shiftISODate(today, Number(m[1]) * (m[2].toLowerCase() === "week" ? 7 : 1));
  } else if ((m = take(new RegExp(`\\s(?:on\\s+|by\\s+|due\\s+)?(next\\s+)?${WEEKDAY_PATTERN}\\b`, "i")))) {
    const target = WEEKDAYS.findIndex((d) => d.startsWith(m![2].toLowerCase().slice(0, 3)));
    const [y, mo, d] = today.split("-").map(Number);
    const current = new Date(y, mo - 1, d).getDay();
    let ahead = (target - current + 7) % 7 || 7;
    if (m[1] && ahead < 7) ahead += 7;
    date = shiftISODate(today, ahead);
  } else if ((m = take(/\s(?:on\s+|by\s+|due\s+)?(\d{1,2})\/(\d{1,2})\b/))) {
    const year = Number(today.slice(0, 4));
    const candidate = `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    date = candidate < today ? `${year + 1}${candidate.slice(4)}` : candidate;
  }

  let time: string | undefined;
  let endTime: string | undefined;
  const range = take(/\s(?:at\s+|from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (range) {
    const endMeridiem = range[6].toLowerCase();
    time = to24h(Number(range[1]), Number(range[2] ?? 0), range[3]?.toLowerCase() ?? endMeridiem) ?? undefined;
    endTime = to24h(Number(range[4]), Number(range[5] ?? 0), endMeridiem) ?? undefined;
  } else if ((m = take(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i))) {
    time = to24h(Number(m[1]), Number(m[2] ?? 0), m[3].toLowerCase()) ?? undefined;
  } else if ((m = take(/\sat\s+(\d{1,2}):(\d{2})\b/i))) {
    time = to24h(Number(m[1]), Number(m[2]), undefined) ?? undefined;
  } else if (take(/\s(?:at\s+)?noon\b/i)) {
    time = "12:00";
  }

  const title = text
    .replace(/\s+(?:at|on|by|due|from)\s*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return null;
  const titled = title[0].toUpperCase() + title.slice(1);

  if (time) {
    return { kind: "event", title: titled, date: date ?? today, time, ...(endTime ? { endTime } : {}) };
  }
  return { kind: "todo", title: titled, ...(date ? { dueDate: date } : {}) };
}
