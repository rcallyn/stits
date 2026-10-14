import { NextRequest } from "next/server";
import { sql } from "@/lib/db";

// Brute-force throttling for the login flow, backed by Postgres so it holds
// up across Vercel's serverless cold starts (an in-memory counter wouldn't
// survive between invocations). The scopes share one table (the `ip` column
// holds whatever the scope is keyed on): the password step, the 2FA-code
// step and signup have different attacker models, so they get separate
// limits and don't share a counter.
const LIMITS: Record<string, { maxAttempts: number; windowMs: number }> = {
  login: { maxAttempts: 8, windowMs: 15 * 60 * 1000 },
  // Keyed on the target email rather than the IP, so guessing one account's
  // password from many IPs is throttled too. Higher than the per-IP limit so
  // a stranger can't lock the owner out quite as easily.
  "login-account": { maxAttempts: 20, windowMs: 15 * 60 * 1000 },
  "2fa": { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
  // Counts every signup request, not just failures, to stop one IP from
  // flooding the admin with approval requests.
  signup: { maxAttempts: 5, windowMs: 60 * 60 * 1000 },
};

// The client IP used to key brute-force throttling. It must be a value the
// client can't set itself, or the limits are trivially bypassed by rotating a
// forged header.
//
// On Vercel, `x-real-ip` is set by the platform to the actual connecting
// address and overwrites anything the client sent. `x-forwarded-for` is
// *appended* to, so its leftmost entry is attacker-controlled — only its
// rightmost entry (the hop Vercel saw) is trustworthy. Prefer x-real-ip,
// fall back to the last x-forwarded-for entry, then a constant (which just
// means every unknown-IP request shares one bucket — fail closed).
export function clientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return "unknown";
}

export async function isRateLimited(
  scope: keyof typeof LIMITS,
  key: string
): Promise<{ limited: boolean; retryAfterSeconds?: number }> {
  const { maxAttempts, windowMs } = LIMITS[scope];
  const [row] = await sql<{ attempts: number; window_start: string }[]>`
    select attempts, window_start from login_attempts where scope = ${scope} and ip = ${key}
  `;
  if (!row) return { limited: false };

  const windowStart = new Date(row.window_start).getTime();
  const windowActive = Date.now() - windowStart <= windowMs;
  if (!windowActive || row.attempts < maxAttempts) return { limited: false };

  return { limited: true, retryAfterSeconds: Math.ceil((windowStart + windowMs - Date.now()) / 1000) };
}

// Counts one attempt against `key`. A success never clears the counter:
// with open signup, anyone can own a valid (even unapproved) account, so a
// reset-on-success would let them interleave their own logins with guesses
// at someone else's password. Counters simply expire with their window.
export async function recordAttempt(scope: keyof typeof LIMITS, key: string): Promise<void> {
  const { windowMs } = LIMITS[scope];
  const [row] = await sql<{ window_start: string }[]>`
    select window_start from login_attempts where scope = ${scope} and ip = ${key}
  `;
  const windowActive = row && Date.now() - new Date(row.window_start).getTime() <= windowMs;

  if (windowActive) {
    await sql`
      update login_attempts set attempts = attempts + 1 where scope = ${scope} and ip = ${key}
    `;
  } else {
    await sql`
      insert into login_attempts (scope, ip, attempts, window_start)
      values (${scope}, ${key}, 1, now())
      on conflict (scope, ip) do update set attempts = 1, window_start = now()
    `;
  }
}
