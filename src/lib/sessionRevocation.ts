import { sql } from "@/lib/db";

// "Log out everywhere": settings.sessions_valid_after holds a cutoff, and any
// session cookie issued before it is rejected (see session.ts). The proxy
// consults it on every request, so it is cached briefly per server instance.
// Revoking clears the cache on the instance that handled the request; other
// instances pick the change up within CACHE_TTL_MS.
const CACHE_TTL_MS = 15_000;
// If the database is unreachable, keep honouring the last value we saw for a
// while rather than locking the owner out; beyond that, fail closed.
const MAX_STALE_MS = 5 * 60_000;

const PG_UNDEFINED_COLUMN = "42703";

let cache: { validAfter: number; fetchedAt: number } | null = null;

export function resetSessionRevocationCache() {
  cache = null;
}

export async function getSessionsValidAfter(now: number = Date.now()): Promise<number> {
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.validAfter;
  try {
    const [row] = await sql<{ sessions_valid_after: Date | null }[]>`
      select sessions_valid_after from settings where id = 1
    `;
    const validAfter = row?.sessions_valid_after ? new Date(row.sessions_valid_after).getTime() : 0;
    cache = { validAfter, fetchedAt: now };
    return validAfter;
  } catch (err) {
    // Column not created yet (schema.sql change not applied): no revocations.
    if ((err as { code?: string })?.code === PG_UNDEFINED_COLUMN) return 0;
    if (cache && now - cache.fetchedAt < MAX_STALE_MS) return cache.validAfter;
    throw err;
  }
}

export async function revokeAllSessions(now: number = Date.now()): Promise<void> {
  await sql`update settings set sessions_valid_after = ${new Date(now)} where id = 1`;
  cache = { validAfter: now, fetchedAt: now };
}
