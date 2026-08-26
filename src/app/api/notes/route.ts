import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { Note } from "@/lib/notes";

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
  const body = await req.json();
  const { text, tag } = body as Partial<Note>;
  if (typeof text !== "string" || !text.trim() || typeof tag !== "string") {
    return NextResponse.json({ error: "Missing text or tag." }, { status: 400 });
  }

  const [row] = await sql<NoteRow[]>`
    insert into notes (text, tag) values (${text.trim()}, ${tag}) returning *
  `;
  return NextResponse.json({ note: rowToNote(row) });
}
