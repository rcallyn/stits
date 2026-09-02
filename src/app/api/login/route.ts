import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPendingCookieValue, PENDING_COOKIE_NAME, SECURE_COOKIES } from "@/lib/session";
import { sendPushoverNotification } from "@/lib/pushover";
import { clientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { verifyAppPassword } from "@/lib/password";

const bodySchema = z.object({ password: z.string().min(1).max(1024) });

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const { limited, retryAfterSeconds } = await isRateLimited("login", ip);
  if (limited) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Missing password." }, { status: 400 });
  }
  const ok = verifyAppPassword(body.data.password);
  await recordAttempt("login", ip, ok);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const code = String(randomInt(100000, 1000000));
  const sent = await sendPushoverNotification(`Your login code: ${code}`, "stits login");
  if (!sent) {
    return NextResponse.json(
      { error: "Couldn't send the push notification. Check the Pushover setup." },
      { status: 502 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PENDING_COOKIE_NAME, await createPendingCookieValue(code), {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "lax",
    maxAge: 5 * 60,
    path: "/",
  });
  return res;
}
