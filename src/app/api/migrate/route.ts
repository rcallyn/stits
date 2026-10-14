import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseBody } from "@/lib/apiValidation";
import { backupImportSchema, REPLACE_CONFIRMATION } from "@/lib/schemas";

// Imports a backup payload into Postgres. Two modes, both idempotent-safe with
// ON CONFLICT DO NOTHING for the per-row inserts:
// - replace: false (default) — a one-time merge of this browser's
//   pre-migration localStorage data; existing rows are left untouched.
// - replace: true — used by the "Import backup" file button, which has always
//   told the user it replaces everything; clears this user's todos and events
//   first so the import fully matches the file's contents. Because that is
//   unrecoverable, it additionally requires `confirm: "REPLACE ALL DATA"` in
//   the body so a stray/replayed request can't wipe the account.
//
// Ids are global across accounts, so a row whose id another account already
// uses (the same backup imported into a second account) gets a fresh id,
// with its events' todo links remapped to match, instead of being skipped.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;
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
      await tx`delete from schedule_events where user_id = ${userId}`;
      await tx`delete from todos where user_id = ${userId}`;
    }

    const takenIds = async (table: "todos" | "schedule_events", ids: string[]) => {
      if (ids.length === 0) return new Set<string>();
      const rows = await tx<{ id: string }[]>`
        select id from ${tx(table)} where id in ${tx(ids)} and user_id <> ${userId}
      `;
      return new Set(rows.map((r) => r.id));
    };
    const todoIdMap = new Map<string, string>();
    for (const id of await takenIds("todos", data.todos.map((t) => t.id))) {
      todoIdMap.set(id, randomUUID());
    }
    const takenEventIds = await takenIds("schedule_events", data.scheduleEvents.map((e) => e.id));
    for (const todo of data.todos) todo.id = todoIdMap.get(todo.id) ?? todo.id;
    for (const event of data.scheduleEvents) {
      if (takenEventIds.has(event.id)) event.id = randomUUID();
      if (event.todoId) event.todoId = todoIdMap.get(event.todoId) ?? event.todoId;
    }

    for (const todo of data.todos) {
      await tx`
        insert into todos (id, user_id, title, description, done, due_date, category, priority, subtasks, completed_at, canvas_id)
        values (
          ${todo.id}, ${userId}, ${todo.title}, ${todo.description ?? null}, ${todo.done ?? false}, ${todo.dueDate ?? null},
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
          (id, user_id, title, date, end_date, time, end_time, todo_id, category, done, notes, is_note_event, recurrence, canvas_id)
        values (
          ${event.id}, ${userId}, ${event.title}, ${event.date}, ${event.endDate ?? null},
          ${event.time ?? ""}, ${event.endTime ?? null},
          ${event.todoId ? tx`(select id from todos where id = ${event.todoId} and user_id = ${userId})` : null},
          ${event.category ?? null}, ${event.done ?? null},
          ${event.notes ? tx.json(event.notes) : null}, ${event.isNoteEvent ?? null},
          ${event.recurrence ? tx.json(event.recurrence) : null}, ${event.canvasId ?? null}
        )
        on conflict (id) do nothing
      `;
    }

    await tx`
      insert into settings (user_id, category_colors, category_labels, category_order)
      values (
        ${userId},
        ${tx.json(data.categoryColors ?? {})},
        ${tx.json(data.categoryLabels ?? {})},
        ${tx.json(data.categoryOrder ?? [])}
      )
      on conflict (user_id) do update set
        category_colors = excluded.category_colors,
        category_labels = excluded.category_labels,
        category_order = excluded.category_order
    `;
  });

  return NextResponse.json({ ok: true });
}
