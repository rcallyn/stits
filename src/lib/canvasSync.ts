import { sql } from "@/lib/db";
import { parseIcs } from "@/lib/ics";
import { shiftISODate } from "@/lib/schedule";

// Canvas assignment sync, run on the server so it can happen both from the
// "Sync now" button and unattended from the daily cron. Each assignment
// becomes a School todo plus an all-day calendar entry linked to it (the same
// shape as dragging a todo onto a day). Course calendar events in the feed
// are ignored.
//
// Deleting a synced todo or its calendar entry is remembered in
// `canvas_dismissed` (see the DELETE routes), so later syncs don't bring it
// back. Completed todos are never touched beyond title/date refreshes.

// There's no browser timezone on the server, so due instants are turned
// into dates in the same zone the daily digest assumes.
export const CANVAS_TIME_ZONE = "America/New_York";

// Canvas's ICS feed can't be queried by date range, so this window only
// bounds which previously-synced todos may be removed when they vanish from
// a fresh fetch — anything outside it is left alone.
const SYNC_DAYS_BACK = 14;
const SYNC_DAYS_FORWARD = 120;

const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

export class CanvasSyncError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export type CanvasAssignment = { canvasId: string; title: string; dueDate: string };

export type SyncedTodo = {
  id: string;
  canvasId: string;
  title: string;
  dueDate: string | null;
  done: boolean;
};

// Any calendar entry pointing at a synced todo — including one the user
// dragged on by hand (canvasId null), which counts as "already on the
// calendar". Only entries with a canvasId are owned, and updated, by sync.
export type LinkedEvent = {
  id: string;
  todoId: string;
  canvasId: string | null;
  title: string;
  date: string;
};

export type CanvasSyncPlan = {
  createTodos: CanvasAssignment[];
  updateTodos: { id: string; title: string; dueDate: string }[];
  createEvents: { todoId: string; canvasId: string; title: string; date: string }[];
  updateEvents: { id: string; title: string; date: string }[];
  deleteTodoIds: string[];
};

export type CanvasSyncResult = { added: number; updated: number; removed: number };

function dateInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** A feed instant as a YYYY-MM-DD date in `timeZone`; plain dates pass through. */
export function isoToDateInZone(iso: string, timeZone = CANVAS_TIME_ZONE): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return dateInZone(new Date(iso), timeZone);
}

export function todayInZone(timeZone = CANVAS_TIME_ZONE): string {
  return dateInZone(new Date(), timeZone);
}

export function planCanvasSync(input: {
  assignments: CanvasAssignment[];
  todos: SyncedTodo[];
  events: LinkedEvent[];
  dismissedTodos: Set<string>;
  dismissedEvents: Set<string>;
  today: string;
}): CanvasSyncPlan {
  const { assignments, todos, events, dismissedTodos, dismissedEvents, today } = input;
  const plan: CanvasSyncPlan = {
    createTodos: [],
    updateTodos: [],
    createEvents: [],
    updateEvents: [],
    deleteTodoIds: [],
  };

  for (const a of assignments) {
    const todo = todos.find((t) => t.canvasId === a.canvasId);
    if (!todo) {
      // Never re-add something the user deleted, and don't import an
      // assignment that was already past due the first time it was seen —
      // the feed has no submission status, so it's most likely done.
      if (dismissedTodos.has(a.canvasId) || a.dueDate < today) continue;
      plan.createTodos.push(a);
      continue;
    }

    if (todo.title !== a.title || todo.dueDate !== a.dueDate) {
      plan.updateTodos.push({ id: todo.id, title: a.title, dueDate: a.dueDate });
    }

    // Calendar entries only for what's still ahead — no point filling past
    // days with assignments that are most likely already handed in.
    const linked = events.filter((e) => e.todoId === todo.id);
    if (linked.length === 0) {
      if (!dismissedEvents.has(a.canvasId) && a.dueDate >= today) {
        plan.createEvents.push({ todoId: todo.id, canvasId: a.canvasId, title: a.title, date: a.dueDate });
      }
      continue;
    }
    for (const event of linked) {
      if (event.canvasId && (event.title !== a.title || event.date !== a.dueDate)) {
        plan.updateEvents.push({ id: event.id, title: a.title, date: a.dueDate });
      }
    }
  }

  // An open synced todo that's no longer in the feed was removed on Canvas's
  // side. Completed ones are kept as history.
  const seen = new Set(assignments.map((a) => a.canvasId));
  const windowStart = shiftISODate(today, -SYNC_DAYS_BACK);
  const windowEnd = shiftISODate(today, SYNC_DAYS_FORWARD);
  for (const todo of todos) {
    if (seen.has(todo.canvasId) || todo.done) continue;
    if (todo.dueDate && (todo.dueDate < windowStart || todo.dueDate > windowEnd)) continue;
    plan.deleteTodoIds.push(todo.id);
  }

  return plan;
}

function checkFeedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new CanvasSyncError("That doesn't look like a valid URL.", 400);
  }
  // This does a server-side fetch of whatever URL it's given, so without a
  // strict allowlist it's an open SSRF proxy (cloud metadata endpoints,
  // internal services). Canvas feeds only ever live on an institution's
  // *.instructure.com subdomain, so that doubles as a tight allowlist.
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || (host !== "instructure.com" && !host.endsWith(".instructure.com"))) {
    throw new CanvasSyncError("Feed URL must be an https://*.instructure.com calendar link.", 400);
  }
  return url;
}

// Redirects are followed by hand so every hop is re-checked against the
// allowlist — fetch's automatic following would only have checked the first.
async function fetchFeedText(feedUrl: string): Promise<string> {
  let url = checkFeedUrl(feedUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch {
      throw new CanvasSyncError("Couldn't reach that feed URL — check that it's correct.", 502);
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = checkFeedUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok) throw new CanvasSyncError(`Canvas returned an error (${res.status}).`, 502);
    const text = await res.text();
    if (!text.includes("BEGIN:VCALENDAR")) {
      throw new CanvasSyncError("That URL didn't return a calendar feed.", 502);
    }
    return text;
  }
  throw new CanvasSyncError("That feed URL redirected too many times.", 502);
}

// Canvas ends each title with the course's full name in brackets, e.g.
// "Quiz 04 [MATH/STAT 418, Section 001: Prob and Stoc Proc. FA26
// (22681--UP---P-STAT----418-------001-)]". Only the course code is kept:
// "Quiz 04 [STAT 418]". The SIS id in parentheses names the real course even
// when it's cross-listed, so it wins; otherwise the first code in the name is
// used (a cross-listing like "CMPEN/EE 362" keeps its first department).
// A name with no recognisable code is left as it is.
const COURSE_TAG = /\s*\[([^\]]+)\]\s*$/;
const SIS_COURSE = /\(\d+-[^)]*?-([A-Z]{2,})-+(\d{3}[A-Z]?)-/;
const COURSE_CODE = /(?<![A-Za-z])([A-Z]{2,6})(?:\/[A-Z]{2,6})*[ _-]?(\d{3}[A-Z]?)(?!\d)/;

export function shortenCourseTag(title: string): string {
  const tag = title.match(COURSE_TAG);
  if (!tag) return title;
  const code = tag[1].match(SIS_COURSE) ?? tag[1].match(COURSE_CODE);
  if (!code) return title;
  return `${title.slice(0, tag.index)} [${code[1]} ${code[2]}]`.trim();
}

async function fetchAssignments(feedUrl: string): Promise<CanvasAssignment[]> {
  const items = parseIcs(await fetchFeedText(feedUrl));
  return items.flatMap((item) =>
    item.kind === "todo"
      ? [{ canvasId: item.canvasId, title: shortenCourseTag(item.title), dueDate: isoToDateInZone(item.dueAtISO) }]
      : []
  );
}

/**
 * Syncs `userId`'s todos from their saved feed URL (after saving `feedUrl`
 * first, if given). Returns null when no feed URL is configured.
 */
export async function runCanvasSync(userId: string, feedUrl?: string): Promise<CanvasSyncResult | null> {
  if (feedUrl !== undefined) {
    checkFeedUrl(feedUrl);
    await sql`
      insert into settings (user_id, canvas_feed_url) values (${userId}, ${feedUrl.trim()})
      on conflict (user_id) do update set canvas_feed_url = excluded.canvas_feed_url
    `;
  }
  const [settings] = await sql<{ canvas_feed_url: string | null }[]>`
    select canvas_feed_url from settings where user_id = ${userId}
  `;
  const savedUrl = settings?.canvas_feed_url?.trim();
  if (!savedUrl) return null;

  const assignments = await fetchAssignments(savedUrl);

  const todos = await sql<SyncedTodo[]>`
    select id, canvas_id as "canvasId", title, due_date as "dueDate", done
    from todos where user_id = ${userId} and canvas_id is not null
  `;
  const events = await sql<LinkedEvent[]>`
    select e.id, e.todo_id as "todoId", e.canvas_id as "canvasId", e.title, e.date
    from schedule_events e join todos t on t.id = e.todo_id
    where t.user_id = ${userId} and t.canvas_id is not null
  `;
  const dismissed = await sql<{ canvas_id: string; scope: string }[]>`
    select canvas_id, scope from canvas_dismissed where user_id = ${userId}
  `;
  const dismissedTodos = new Set(dismissed.filter((d) => d.scope === "todo").map((d) => d.canvas_id));
  const dismissedEvents = new Set(dismissed.filter((d) => d.scope === "event").map((d) => d.canvas_id));

  const plan = planCanvasSync({
    assignments,
    todos,
    events,
    dismissedTodos,
    dismissedEvents,
    today: todayInZone(),
  });

  await sql.begin(async (tx) => {
    for (const a of plan.createTodos) {
      const [row] = await tx<{ id: string }[]>`
        insert into todos (user_id, title, due_date, category, canvas_id)
        values (${userId}, ${a.title}, ${a.dueDate}, 'school', ${a.canvasId})
        returning id
      `;
      if (!dismissedEvents.has(a.canvasId)) {
        await tx`
          insert into schedule_events (user_id, title, date, time, todo_id, category, canvas_id)
          values (${userId}, ${a.title}, ${a.dueDate}, '', ${row.id}, 'school', ${a.canvasId})
        `;
      }
    }
    for (const u of plan.updateTodos) {
      await tx`update todos set title = ${u.title}, due_date = ${u.dueDate} where id = ${u.id} and user_id = ${userId}`;
    }
    for (const e of plan.createEvents) {
      await tx`
        insert into schedule_events (user_id, title, date, time, todo_id, category, canvas_id)
        values (${userId}, ${e.title}, ${e.date}, '', ${e.todoId}, 'school', ${e.canvasId})
      `;
    }
    for (const u of plan.updateEvents) {
      await tx`update schedule_events set title = ${u.title}, date = ${u.date} where id = ${u.id} and user_id = ${userId}`;
    }
    // Linked calendar entries go too, via the todo_id cascade. Not recorded
    // as dismissed: if Canvas brings it back, it's genuinely new again.
    if (plan.deleteTodoIds.length > 0) {
      await tx`delete from todos where user_id = ${userId} and id in ${tx(plan.deleteTodoIds)}`;
    }
    await tx`update settings set canvas_last_synced_at = now() where user_id = ${userId}`;
  });

  return {
    added: plan.createTodos.length,
    updated: plan.updateTodos.length,
    removed: plan.deleteTodoIds.length,
  };
}
