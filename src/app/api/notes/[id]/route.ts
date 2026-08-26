import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { Note } from "@/lib/notes";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const changes = (await req.json()) as Partial<Omit<Note, "id" | "createdAt">>;

  const fields: Record<string, unknown> = {};
  if ("text" in changes) fields.text = changes.text;
  if ("tag" in changes) fields.tag = changes.tag;
  if ("pinned" in changes) fields.pinned = changes.pinned ?? null;

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No changes." }, { status: 400 });
  }

  await sql`update notes set ${sql(fields)} where id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await sql`delete from notes where id = ${id}`;
  return NextResponse.json({ ok: true });
}
