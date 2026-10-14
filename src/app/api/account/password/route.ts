import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkCurrentPassword, requireUser, setSessionCookie } from "@/lib/auth";
import { parseBody } from "@/lib/apiValidation";
import { passwordChangeSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/password";

// Changing the password also bumps the session version, which signs out
// every other device (including any stolen session); this one gets a fresh
// cookie so it stays signed in.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseBody(req, passwordChangeSchema);
  if (!parsed.ok) return parsed.response;

  const denied = await checkCurrentPassword(req, auth.user, parsed.data.currentPassword);
  if (denied) return denied;

  const [row] = await sql<{ session_version: number }[]>`
    update users set
      password_hash = ${hashPassword(parsed.data.newPassword)},
      session_version = session_version + 1
    where id = ${auth.user.id}
    returning session_version
  `;
  const res = NextResponse.json({ ok: true });
  await setSessionCookie(res, auth.user.id, row.session_version);
  return res;
}
