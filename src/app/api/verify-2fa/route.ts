import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionCookieValue,
  verifyPendingCookieValue,
  PENDING_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  SECURE_COOKIES,
} from "@/lib/session";
import { clientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";

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
