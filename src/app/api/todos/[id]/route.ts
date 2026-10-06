import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { parseBody } from "@/lib/apiValidation";
import { todoPatchSchema } from "@/lib/schemas";

const idSchema = z.uuid();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid todo id." }, { status: 400 });
  }

  const parsed = await parseBody(req, todoPatchSchema);
  if (!parsed.ok) return parsed.response;
  const changes = parsed.data;

  const fields: Record<string, unknown> = {};
  if ("title" in changes) fields.title = changes.title;
  if ("description" in changes) fields.description = changes.description ?? null;
  if ("done" in changes) fields.done = changes.done;
  if ("dueDate" in changes) fields.due_date = changes.dueDate ?? null;
  if ("category" in changes) fields.category = changes.category ?? null;
  if ("priority" in changes) fields.priority = changes.priority ?? null;
  if ("subtasks" in changes) {
    fields.subtasks = changes.subtasks ? sql.json(changes.subtasks) : null;
  }
  if ("completedAt" in changes) fields.completed_at = changes.completedAt ?? null;

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No changes." }, { status: 400 });
  }

  await sql`update todos set ${sql(fields)} where id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid todo id." }, { status: 400 });
  }
  await sql`delete from todos where id = ${id}`;
  return NextResponse.json({ ok: true });
}
