import { NextRequest, NextResponse } from "next/server";
import { createPendingCookieValue, PENDING_COOKIE_NAME, SECURE_COOKIES } from "@/lib/session";
import { sendPushoverNotification } from "@/lib/pushover";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (typeof password !== "string" || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
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
