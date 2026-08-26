import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { baseEventId, ScheduleEvent } from "@/lib/schedule";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const realId = baseEventId(id);
  const changes = (await req.json()) as Partial<Omit<ScheduleEvent, "id">>;

  const fields: Record<string, unknown> = {};
  if ("title" in changes) fields.title = changes.title;
  if ("date" in changes) fields.date = changes.date;
  if ("endDate" in changes) fields.end_date = changes.endDate ?? null;
  if ("time" in changes) fields.time = changes.time ?? "";
  if ("endTime" in changes) fields.end_time = changes.endTime ?? null;
  if ("done" in changes) fields.done = changes.done ?? null;
  if ("category" in changes) fields.category = changes.category ?? null;
  if ("notes" in changes) fields.notes = changes.notes ? sql.json(changes.notes) : null;
  if ("recurrence" in changes) {
    fields.recurrence = changes.recurrence ? sql.json(changes.recurrence) : null;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No changes." }, { status: 400 });
  }

  await sql`update schedule_events set ${sql(fields)} where id = ${realId}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await sql`delete from schedule_events where id = ${baseEventId(id)}`;
  return NextResponse.json({ ok: true });
}
