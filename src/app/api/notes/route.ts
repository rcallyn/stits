import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { Note } from "@/lib/notes";
import { parseBody } from "@/lib/apiValidation";
import { noteCreateSchema } from "@/lib/schemas";

type NoteRow = {
  id: string;
  text: string;
  tag: string;
  created_at: string;
  pinned: boolean | null;
};

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    text: row.text,
    tag: row.tag as Note["tag"],
    createdAt: row.created_at,
    pinned: row.pinned ?? undefined,
  };
}

export async function GET() {
  const rows = await sql<NoteRow[]>`select * from notes order by pinned desc nulls last, created_at desc`;
  return NextResponse.json({ notes: rows.map(rowToNote) });
}

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, noteCreateSchema);
  if (!parsed.ok) return parsed.response;
  const { text, tag } = parsed.data;

  const [row] = await sql<NoteRow[]>`
    insert into notes (text, tag) values (${text}, ${tag}) returning *
  `;
  return NextResponse.json({ note: rowToNote(row) });
}
