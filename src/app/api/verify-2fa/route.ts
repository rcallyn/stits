import { NextRequest, NextResponse } from "next/server";
import {
  createSessionCookieValue,
  verifyPendingCookieValue,
  PENDING_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  SECURE_COOKIES,
} from "@/lib/session";
import { clientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const { limited, retryAfterSeconds } = await isRateLimited("2fa", ip);
  if (limited) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const { code } = await req.json();
  if (typeof code !== "string") {
    return NextResponse.json({ error: "Missing code." }, { status: 400 });
  }

  const pending = req.cookies.get(PENDING_COOKIE_NAME)?.value;
  const ok = await verifyPendingCookieValue(pending, code);
  await recordAttempt("2fa", ip, ok);
  if (!ok) {
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
