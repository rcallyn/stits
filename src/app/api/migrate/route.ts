import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { parseBody } from "@/lib/apiValidation";
import { backupImportSchema, REPLACE_CONFIRMATION } from "@/lib/schemas";

// Imports a backup payload into Postgres. Two modes, both idempotent-safe with
// ON CONFLICT DO NOTHING for the per-row inserts:
// - replace: false (default) — a one-time merge of this browser's
//   pre-migration localStorage data; existing rows are left untouched.
// - replace: true — used by the "Import backup" file button, which has always
//   told the user it replaces everything; clears the two tables first so the
//   import fully matches the file's contents. Because that is unrecoverable,
//   it additionally requires `confirm: "REPLACE ALL DATA"` in the body so a
//   stray/replayed request can't wipe the database.
export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, backupImportSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;
  const replace = data.replace === true;

  if (replace && data.confirm !== REPLACE_CONFIRMATION) {
    return NextResponse.json(
      { error: `Destructive import requires confirm: "${REPLACE_CONFIRMATION}".` },
      { status: 400 }
    );
  }

  await sql.begin(async (tx) => {
    if (replace) {
      await tx`delete from schedule_events`;
      await tx`delete from todos`;
    }

    for (const todo of data.todos) {
      await tx`
        insert into todos (id, title, description, done, due_date, category, priority, subtasks, completed_at, canvas_id)
        values (
          ${todo.id}, ${todo.title}, ${todo.description ?? null}, ${todo.done ?? false}, ${todo.dueDate ?? null},
          ${todo.category ?? null}, ${todo.priority ?? null},
          ${todo.subtasks ? tx.json(todo.subtasks) : null},
          ${todo.completedAt ?? null}, ${todo.canvasId ?? null}
        )
        on conflict (id) do nothing
      `;
    }

    for (const event of data.scheduleEvents) {
      await tx`
        insert into schedule_events
          (id, title, date, end_date, time, end_time, todo_id, category, done, notes, is_note_event, recurrence, canvas_id)
        values (
          ${event.id}, ${event.title}, ${event.date}, ${event.endDate ?? null},
          ${event.time ?? ""}, ${event.endTime ?? null}, ${event.todoId ?? null},
          ${event.category ?? null}, ${event.done ?? null},
          ${event.notes ? tx.json(event.notes) : null}, ${event.isNoteEvent ?? null},
          ${event.recurrence ? tx.json(event.recurrence) : null}, ${event.canvasId ?? null}
        )
        on conflict (id) do nothing
      `;
    }

    await tx`
      update settings set
        category_colors = ${tx.json(data.categoryColors ?? {})},
        category_labels = ${tx.json(data.categoryLabels ?? {})},
        category_order = ${tx.json(data.categoryOrder ?? [])}
      where id = 1
    `;
  });

  return NextResponse.json({ ok: true });
}
