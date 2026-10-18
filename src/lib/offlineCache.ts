// Last-known-good copies of the entity lists (todos, events), kept in
// localStorage so the app can still show something when the first load fails
// because the device is offline. Read-only: it is only consulted when the
// network fetch fails, never in place of one.
//
// The copy holds the signed-in user's data on the device, so it is wiped on
// logout, "log out everywhere", and whenever the API answers 401.

const PREFIX = "stits:offline:";
const VERSION = 1;

type Stored<T> = { v: number; savedAt: number; items: T[] };

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // blocked storage throws on access in some browsers
  }
}

export function saveOfflineCopy<T>(key: string, items: T[]) {
  try {
    const entry: Stored<T> = { v: VERSION, savedAt: Date.now(), items };
    storage()?.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // quota exceeded or storage disabled: offline reads are best-effort
  }
}

export function loadOfflineCopy<T>(key: string): { items: T[]; savedAt: number } | null {
  try {
    const raw = storage()?.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored<T>>;
    if (parsed.v !== VERSION || !Array.isArray(parsed.items) || typeof parsed.savedAt !== "number") {
      return null;
    }
    return { items: parsed.items, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function clearOfflineCopy(key: string) {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/** Remove every saved copy (logout, session revoked). */
export function clearAllOfflineCopies() {
  const s = storage();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) s.removeItem(k);
  } catch {
    // ignore
  }
}

/** "5 minutes ago" style age for the offline notice. */
export function describeAge(savedAt: number, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - savedAt) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}
