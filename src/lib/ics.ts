// Minimal RFC 5545 VEVENT parser — just enough to read a Canvas calendar
// feed. Canvas UIDs are consistently prefixed by item type, which is how we
// tell an assignment/quiz/discussion deadline (due date, no real duration)
// apart from an actual course calendar event (a real start/end time) —
// there's no separate "type" field like the Planner API had.
export type IcsPlannerItem =
  | { kind: "todo"; canvasId: string; title: string; dueAtISO: string }
  | {
      kind: "event";
      canvasId: string;
      title: string;
      startAtISO: string;
      endAtISO?: string;
      allDay: boolean;
    };

function unescapeIcsText(value: string): string {
  return value.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

// Long lines are "folded" across multiple physical lines, each continuation
// starting with a single space or tab — undo that before parsing name/value.
function unfoldLines(raw: string): string[] {
  const rawLines = raw.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else if (line.length > 0) {
      lines.push(line);
    }
  }
  return lines;
}

function parseLine(line: string): { name: string; params: Record<string, string>; value: string } {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return { name: "", params: {}, value: "" };
  const head = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value };
}

// Returns `iso` as either a plain "YYYY-MM-DD" (all-day) or a full
// "YYYY-MM-DDTHH:mm:ssZ" instant — both safe inputs for `new Date()`.
function parseIcsDateTime(value: string, params: Record<string, string>): { iso: string; allDay: boolean } | null {
  if (params.VALUE === "DATE" || /^\d{8}$/.test(value)) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return { iso: `${m[1]}-${m[2]}-${m[3]}`, allDay: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  // Canvas feeds are UTC in practice; a bare TZID/floating time (no trailing
  // Z) is treated as UTC too rather than attempting IANA offset resolution.
  return { iso: `${y}-${mo}-${d}T${h}:${mi}:${s}Z`, allDay: false };
}

type RawFields = Record<string, { params: Record<string, string>; value: string }>;

function buildItem(fields: RawFields): IcsPlannerItem | null {
  const uid = fields.UID?.value;
  const summaryRaw = fields.SUMMARY?.value;
  if (!uid || !summaryRaw) return null;
  const title = unescapeIcsText(summaryRaw);

  const dtstart = fields.DTSTART;
  if (!dtstart) return null;
  const start = parseIcsDateTime(dtstart.value, dtstart.params);
  if (!start) return null;

  const dtend = fields.DTEND;
  const end = dtend ? parseIcsDateTime(dtend.value, dtend.params) : null;

  const isCalendarEvent = /^event-calendar-event-/.test(uid);
  if (!isCalendarEvent) {
    return { kind: "todo", canvasId: uid, title, dueAtISO: start.iso };
  }

  return {
    kind: "event",
    canvasId: uid,
    title,
    startAtISO: start.iso,
    endAtISO: end?.iso,
    allDay: start.allDay,
  };
}

export function parseIcs(raw: string): IcsPlannerItem[] {
  const lines = unfoldLines(raw);
  const items: IcsPlannerItem[] = [];
  let current: RawFields | null = null;

  for (const line of lines) {
    const { name, params, value } = parseLine(line);
    if (name === "BEGIN" && value === "VEVENT") {
      current = {};
      continue;
    }
    if (name === "END" && value === "VEVENT") {
      if (current) {
        const item = buildItem(current);
        if (item) items.push(item);
      }
      current = null;
      continue;
    }
    if (!current || !name) continue;
    current[name] = { params, value };
  }

  return items;
}
