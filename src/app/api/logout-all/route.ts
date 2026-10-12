import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { revokeAllSessions } from "@/lib/sessionRevocation";

// Invalidates every session cookie issued so far (this device included), so a
// lost phone or a forgotten browser can be cut off.
export async function POST() {
  await revokeAllSessions();
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
