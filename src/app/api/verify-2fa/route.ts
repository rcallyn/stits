import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPendingCookieValue, PENDING_COOKIE_NAME } from "@/lib/session";
import { clientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { setSessionCookie } from "@/lib/auth";
import { sql } from "@/lib/db";

const bodySchema = z.object({ code: z.string().min(1).max(64) });

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const { limited, retryAfterSeconds } = await isRateLimited("2fa", ip);
  if (limited) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Missing code." }, { status: 400 });
  }
  const { code } = body.data;

  const pending = req.cookies.get(PENDING_COOKIE_NAME)?.value;
  const userId = await verifyPendingCookieValue(pending, code);
  if (!userId) {
    await recordAttempt("2fa", ip);
    return NextResponse.json({ error: "Incorrect or expired code." }, { status: 401 });
  }
  // The account could have been removed in the five minutes since step one.
  const [user] = await sql<{ session_version: number }[]>`
    select session_version from users where id = ${userId} and status = 'active'
  `;
  if (!user) {
    return NextResponse.json({ error: "This account can't sign in." }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  await setSessionCookie(res, userId, user.session_version);
  res.cookies.delete(PENDING_COOKIE_NAME);
  return res;
}
