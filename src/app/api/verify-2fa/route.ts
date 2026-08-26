import { NextRequest, NextResponse } from "next/server";
import {
  createSessionCookieValue,
  verifyPendingCookieValue,
  PENDING_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  SECURE_COOKIES,
} from "@/lib/session";

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  if (typeof code !== "string") {
    return NextResponse.json({ error: "Missing code." }, { status: 400 });
  }

  const pending = req.cookies.get(PENDING_COOKIE_NAME)?.value;
  if (!(await verifyPendingCookieValue(pending, code))) {
    return NextResponse.json({ error: "Incorrect or expired code." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, await createSessionCookieValue(), {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  res.cookies.delete(PENDING_COOKIE_NAME);
  return res;
}
