import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  expandRecurringEvents,
  formatEventTime,
  isEventOnDate,
  ScheduleEvent,
} from "@/lib/schedule";
import { isOverdue, Todo } from "@/lib/todos";
import { sendPushoverNotification } from "@/lib/pushover";
import { quoteOfTheDay } from "@/lib/quotes";
import { runCanvasSync } from "@/lib/canvasSync";

// Vercel Cron jobs can only run at a fixed UTC time and Hobby-plan projects
// can't run more often than daily, so a single trigger can't stay pinned to
// 7am US Eastern across the DST boundary. vercel.json instead schedules this
// route twice a day (covering both EDT and EST), and this check makes only
// the one that actually lands on 7am ET do anything.
const TARGET_HOUR_ET = 7;

// Every user's Canvas sync and digest share one invocation.
export const maxDuration = 60;

type EventRow = {
  id: string;
  title: string;
  date: string;
  end_date: string | null;
  time: string;
  end_time: string | null;
  category: string | null;
  recurrence: ScheduleEvent["recurrence"] | null;
};

type TodoRow = {
  id: string;
  title: string;
  done: boolean;
  due_date: string | null;
};

function currentEasternHourAndDate(): { hour: number; isoDate: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // "24" is what this formatter uses for midnight instead of "00".
  const hour = Number(get("hour")) % 24;
  return { hour, isoDate: `${get("year")}-${get("month")}-${get("day")}` };
}

// One user's digest: today's events (recurrences expanded) and todos due
// today or overdue, under a quote of the day.
async function buildDigest(userId: string, today: string) {
  const eventRows = await sql<EventRow[]>`
    select id, title, date, end_date, time, end_time, category, recurrence from schedule_events
    where user_id = ${userId}
  `;
  const events: ScheduleEvent[] = eventRows.map((row) => ({
    id: row.id,
    title: row.title,
    date: row.date,
    endDate: row.end_date ?? undefined,
    time: row.time,
    endTime: row.end_time ?? undefined,
    category: (row.category as ScheduleEvent["category"]) ?? undefined,
    recurrence: row.recurrence ?? undefined,
  }));
  const todayEvents = expandRecurringEvents(events, today, today)
    .filter((event) => isEventOnDate(event, today))
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

  const todoRows = await sql<TodoRow[]>`
    select id, title, done, due_date from todos
    where user_id = ${userId} and done = false and due_date is not null
  `;
  const todos: Todo[] = todoRows.map((row) => ({
    id: row.id,
    title: row.title,
    done: row.done,
    dueDate: row.due_date ?? undefined,
  }));
  const dueTodos = todos
    .filter((todo) => todo.dueDate === today || isOverdue(todo))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const quote = quoteOfTheDay(today);
  const lines: string[] = [`"${quote.text}" — ${quote.author}`, ""];
  if (todayEvents.length === 0) {
    lines.push("No events today.");
  } else {
    for (const event of todayEvents.slice(0, 10)) {
      lines.push(event.time ? `${formatEventTime(event.time)} ${event.title}` : `All day: ${event.title}`);
    }
    if (todayEvents.length > 10) lines.push(`+${todayEvents.length - 10} more`);
  }

  if (dueTodos.length > 0) {
    lines.push("");
    lines.push("Todos:");
    for (const todo of dueTodos.slice(0, 8)) {
      const overdue = isOverdue(todo);
      lines.push(`${overdue ? "⚠ " : ""}${todo.title}${overdue ? " (overdue)" : ""}`);
    }
    if (dueTodos.length > 8) lines.push(`+${dueTodos.length - 8} more`);
  }

  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { hour, isoDate: today } = currentEasternHourAndDate();
  if (hour !== TARGET_HOUR_ET) {
    return NextResponse.json({ skipped: true, reason: `hour ${hour} != ${TARGET_HOUR_ET}` });
  }

  const users = await sql<{ id: string; pushover_user_key: string | null; canvas_feed_url: string | null }[]>`
    select u.id, u.pushover_user_key, s.canvas_feed_url
    from users u left join settings s on s.user_id = u.id
    where u.status = 'active'
  `;

  const dayLabel = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Pull in new Canvas assignments first so today's digests include them.
  // The feeds are fetched concurrently so one slow feed can't use up the
  // whole invocation, and a feed problem shouldn't cost anyone's digest, so
  // a failure is only logged.
  await Promise.all(
    users
      .filter((u) => u.canvas_feed_url)
      .map((u) =>
        runCanvasSync(u.id).catch((err) => {
          console.error(`Daily Canvas sync failed for user ${u.id}:`, err);
        })
      )
  );

  let sent = 0;
  let failed = 0;
  for (const user of users) {
    if (!user.pushover_user_key) continue;
    try {
      const message = await buildDigest(user.id, today);
      const ok = await sendPushoverNotification(user.pushover_user_key, message, `stits — ${dayLabel}`);
      if (ok) sent++;
      else failed++;
    } catch (err) {
      failed++;
      console.error(`Daily digest failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ today, users: users.length, sent, failed });
}
