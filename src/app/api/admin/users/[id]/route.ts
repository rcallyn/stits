import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/apiValidation";
import { adminUserPatchSchema } from "@/lib/schemas";

const idSchema = z.uuid();

// Approves a pending signup.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }
  const parsed = await parseBody(req, adminUserPatchSchema);
  if (!parsed.ok) return parsed.response;

  const [row] = await sql`update users set status = ${parsed.data.status} where id = ${id} returning id`;
  if (!row) return NextResponse.json({ error: "No such user." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// Rejects a pending signup or removes an account, with all of its data (the
// foreign keys cascade). Admin accounts can't be removed here, so an admin
// can't lock themselves or another admin out by mistake.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  const [row] = await sql`delete from users where id = ${id} and not is_admin returning id`;
  if (!row) return NextResponse.json({ error: "No such user, or it's an admin." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
