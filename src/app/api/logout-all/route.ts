import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/session";

// Bumps the user's session version, which invalidates every session cookie
// issued so far (this device included), so a lost phone or a forgotten
// browser can be cut off without changing the password.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  await sql`update users set session_version = session_version + 1 where id = ${auth.user.id}`;
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
