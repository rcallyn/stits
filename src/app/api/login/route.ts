import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { normalizeEmail, setSessionCookie, UserStatus } from "@/lib/auth";
import { createPendingCookieValue, PENDING_COOKIE_NAME, SECURE_COOKIES } from "@/lib/session";
import { sendPushoverNotification } from "@/lib/pushover";
import { clientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { verifyPasswordOrDummy } from "@/lib/password";

const bodySchema = z.object({
  email: z.string().min(1).max(320),
  password: z.string().min(1).max(1024),
});

type UserRow = {
  id: string;
  password_hash: string;
  status: UserStatus;
  pushover_user_key: string | null;
  session_version: number;
};

const tooMany = (retryAfterSeconds?: number) =>
  NextResponse.json(
    { error: "Too many attempts. Try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );

// Step one of login. Users with a Pushover key get a one-time code pushed to
// their phone and finish at /api/verify-2fa; everyone else is signed in here.
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const byIp = await isRateLimited("login", ip);
  if (byIp.limited) return tooMany(byIp.retryAfterSeconds);

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }
  const email = normalizeEmail(body.data.email);
  const byAccount = await isRateLimited("login-account", email);
  if (byAccount.limited) return tooMany(byAccount.retryAfterSeconds);

  const [user] = await sql<UserRow[]>`
    select id, password_hash, status, pushover_user_key, session_version from users
    where email = ${email}
  `;
  const ok = verifyPasswordOrDummy(body.data.password, user?.password_hash);
  if (!ok) {
    await Promise.all([recordAttempt("login", ip), recordAttempt("login-account", email)]);
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
  // Only revealed after the correct password, so it doesn't tell a stranger
  // which emails have signed up.
  if (user.status !== "active") {
    return NextResponse.json(
      { error: "Your account is waiting for approval. Try again once you've been approved." },
      { status: 403 }
    );
  }

  if (!user.pushover_user_key) {
    const res = NextResponse.json({ ok: true, twoFactor: false });
    await setSessionCookie(res, user.id, user.session_version);
    return res;
  }

  const code = String(randomInt(100000, 1000000));
  const sent = await sendPushoverNotification(user.pushover_user_key, `Your login code: ${code}`, "stits login");
  if (!sent) {
    return NextResponse.json(
      { error: "Couldn't send the push notification. Check the Pushover setup." },
      { status: 502 }
    );
  }

  const res = NextResponse.json({ ok: true, twoFactor: true });
  res.cookies.set(PENDING_COOKIE_NAME, await createPendingCookieValue(user.id, code), {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "lax",
    maxAge: 5 * 60,
    path: "/",
  });
  return res;
}
