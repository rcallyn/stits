import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { Todo } from "@/lib/todos";
import { parseBody } from "@/lib/apiValidation";
import { todoCreateSchema } from "@/lib/schemas";

type TodoRow = {
  id: string;
  title: string;
  done: boolean;
  due_date: string | null;
  category: string | null;
  priority: string | null;
  subtasks: Todo["subtasks"] | null;
  completed_at: string | null;
  canvas_id: string | null;
};

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    done: row.done,
    dueDate: row.due_date ?? undefined,
    category: (row.category as Todo["category"]) ?? undefined,
    priority: (row.priority as Todo["priority"]) ?? undefined,
    subtasks: row.subtasks ?? undefined,
    completedAt: row.completed_at ?? undefined,
    canvasId: row.canvas_id ?? undefined,
  };
}

export async function GET() {
  const rows = await sql<TodoRow[]>`select * from todos order by due_date nulls last, title`;
  return NextResponse.json({ todos: rows.map(rowToTodo) });
}

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, todoCreateSchema);
  if (!parsed.ok) return parsed.response;
  const { title, dueDate, category, priority, subtasks, canvasId } = parsed.data;

  const [row] = await sql<TodoRow[]>`
    insert into todos (title, due_date, category, priority, subtasks, canvas_id)
    values (
      ${title},
      ${dueDate ?? null},
      ${category ?? null},
      ${priority ?? null},
      ${subtasks ? sql.json(subtasks) : null},
      ${canvasId ?? null}
    )
    returning *
  `;
  return NextResponse.json({ todo: rowToTodo(row) });
}
