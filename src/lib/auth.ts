import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { clientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";
import {
  createSessionCookieValue,
  getSessionClaims,
  SECURE_COOKIES,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export type UserStatus = "pending" | "active";

export type SessionUser = {
  id: string;
  email: string;
  isAdmin: boolean;
  hasPushover: boolean;
  sessionVersion: number;
};

type AuthResult = { ok: true; user: SessionUser } | { ok: false; response: NextResponse };

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// The proxy has already checked the cookie's signature, but it can't reach
// the database. Every data route calls this too, so a user who's been
// removed (or was never approved), or a session from before a password
// change, is refused even with a validly signed cookie, and every query is
// scoped to `user.id`.
export async function requireUser(req: NextRequest): Promise<AuthResult> {
  const claims = await getSessionClaims(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!claims) return { ok: false, response: unauthorized() };

  const [row] = await sql<
    { id: string; email: string; is_admin: boolean; has_pushover: boolean; session_version: number }[]
  >`
    select id, email, is_admin, pushover_user_key is not null as has_pushover, session_version
    from users
    where id = ${claims.userId} and status = 'active' and session_version = ${claims.version}
  `;
  if (!row) return { ok: false, response: unauthorized() };
  return {
    ok: true,
    user: {
      id: row.id,
      email: row.email,
      isAdmin: row.is_admin,
      hasPushover: row.has_pushover,
      sessionVersion: row.session_version,
    },
  };
}

export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const auth = await requireUser(req);
  if (auth.ok && !auth.user.isAdmin) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}

export async function setSessionCookie(res: NextResponse, userId: string, sessionVersion: number) {
  res.cookies.set(SESSION_COOKIE_NAME, await createSessionCookieValue(userId, sessionVersion), {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// For account changes that need the password again (changing it, or turning
// 2FA off), so a stolen session alone can't take the account over. Counts
// against the same limits as login. Returns an error response, or null when
// the password is right.
export async function checkCurrentPassword(
  req: NextRequest,
  user: SessionUser,
  password: string
): Promise<NextResponse | null> {
  const ip = clientIp(req);
  for (const [scope, key] of [["login", ip], ["login-account", user.email]] as const) {
    const { limited, retryAfterSeconds } = await isRateLimited(scope, key);
    if (limited) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }
  }
  const [row] = await sql<{ password_hash: string }[]>`
    select password_hash from users where id = ${user.id}
  `;
  if (row && verifyPassword(password, row.password_hash)) return null;
  await Promise.all([recordAttempt("login", ip), recordAttempt("login-account", user.email)]);
  return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
}
