import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ScheduleEvent } from "@/lib/schedule";
import { parseBody } from "@/lib/apiValidation";
import { eventCreateSchema } from "@/lib/schemas";

type EventRow = {
  id: string;
  title: string;
  date: string;
  end_date: string | null;
  time: string;
  end_time: string | null;
  todo_id: string | null;
  category: string | null;
  done: boolean | null;
  notes: ScheduleEvent["notes"] | null;
  is_note_event: boolean | null;
  recurrence: ScheduleEvent["recurrence"] | null;
  canvas_id: string | null;
};

function rowToEvent(row: EventRow): ScheduleEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    endDate: row.end_date ?? undefined,
    time: row.time,
    endTime: row.end_time ?? undefined,
    todoId: row.todo_id ?? undefined,
    category: (row.category as ScheduleEvent["category"]) ?? undefined,
    done: row.done ?? undefined,
    notes: row.notes ?? undefined,
    isNoteEvent: row.is_note_event ?? undefined,
    recurrence: row.recurrence ?? undefined,
    canvasId: row.canvas_id ?? undefined,
  };
}

// A todo link is kept only when that todo belongs to the same user, so an
// event can't be attached to (and cascade-deleted with) someone else's todo.
function linkedTodo(todoId: string | undefined, userId: string) {
  return todoId ? sql`(select id from todos where id = ${todoId} and user_id = ${userId})` : null;
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;
  const rows = await sql<EventRow[]>`
    select * from schedule_events where user_id = ${userId} order by date, time
  `;
  return NextResponse.json({ events: rows.map(rowToEvent) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;
  const parsed = await parseBody(req, eventCreateSchema);
  if (!parsed.ok) return parsed.response;
  const {
    title,
    date,
    endDate,
    time,
    endTime,
    todoId,
    category,
    notes,
    isNoteEvent,
    recurrence,
    canvasId,
  } = parsed.data;

  const [row] = await sql<EventRow[]>`
    insert into schedule_events
      (user_id, title, date, end_date, time, end_time, todo_id, category, notes, is_note_event, recurrence, canvas_id)
    values (
      ${userId},
      ${title},
      ${date},
      ${endDate ?? null},
      ${time ?? ""},
      ${endTime ?? null},
      ${linkedTodo(todoId, userId)},
      ${category ?? null},
      ${notes ? sql.json(notes) : null},
      ${isNoteEvent ?? null},
      ${recurrence ? sql.json(recurrence) : null},
      ${canvasId ?? null}
    )
    returning *
  `;
  return NextResponse.json({ event: rowToEvent(row) });
}
