import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { parseBody } from "@/lib/apiValidation";
import { notePatchSchema } from "@/lib/schemas";

const idSchema = z.uuid();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid note id." }, { status: 400 });
  }

  const parsed = await parseBody(req, notePatchSchema);
  if (!parsed.ok) return parsed.response;
  const changes = parsed.data;

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
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid note id." }, { status: 400 });
  }
  await sql`delete from notes where id = ${id}`;
  return NextResponse.json({ ok: true });
}
