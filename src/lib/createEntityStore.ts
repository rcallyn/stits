"use client";

import { pushToast } from "@/lib/toast";
import { clearOfflineCopy, describeAge, loadOfflineCopy, saveOfflineCopy } from "@/lib/offlineCache";

// Shared machinery behind useTodos / useNotes / useScheduleEvents. Each of
// those was a near-identical hand-rolled module store: a mutable array, a
// listener Set, a hydrate-once guard, a `refresh()` that refetches the whole
// list, and mutations that optimistically patch the array then fire a request
// and `.finally(refresh)`. The one behaviour they were all missing was any
// signal when a write failed — the catch blocks just left the cache alone.
//
// createEntityStore keeps that model (optimistic write, then reconcile
// against a full refetch) but routes every failure through a toast, and the
// refetch that follows a failed write doubles as the rollback. It exposes the
// plain useSyncExternalStore primitives; each hook file wires them into an
// actual `useX()` hook so the rules-of-hooks lint still applies there.

export type EntityStore<T> = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T[];
  getServerSnapshot: () => T[];
  getHydratedSnapshot: () => boolean;
  getServerHydratedSnapshot: () => boolean;
  ensureHydrated: () => void;
  /** Refetch the whole list from the server and replace the cache. */
  refresh: () => Promise<boolean>;
  /** Current list, for callers outside React (e.g. cross-store cache busting). */
  getAll: () => T[];
  /**
   * Apply `optimistic` to the cache immediately, then run `send`. If `send`
   * rejects or resolves non-ok, show an error toast. Always refetch afterwards
   * so the cache reconciles with the server (this is also how a failed
   * optimistic change gets rolled back).
   */
  mutate: (
    optimistic: (current: T[]) => T[],
    send: () => Promise<Response>,
    opts?: { action?: string; afterRefresh?: () => void }
  ) => void;
};

export function createEntityStore<T>(config: {
  /** Read at fetch time, so a store can change what it asks for (e.g. a date window). */
  endpoint: string | (() => string);
  /** Pull the list out of the GET response envelope and sort it. */
  fromResponse: (data: unknown) => T[];
  /** Human noun for error toasts, e.g. "todo". */
  noun: string;
  /**
   * localStorage key for an offline copy. When set, each successful fetch
   * saves the list, and a first load that fails outright falls back to it.
   */
  offlineKey?: string;
}): EntityStore<T> {
  const { endpoint, fromResponse, noun, offlineKey } = config;

  let store: T[] = [];
  let hydrated = false;
  let hydrating = false;
  const listeners = new Set<() => void>();
  const EMPTY: T[] = [];

  // Refetches can resolve out of order, and one that started before a write
  // landed carries the pre-write list. Applying it would briefly undo the
  // user's change (e.g. a just-ticked todo reappearing), so only the newest
  // refetch is applied, and none while a write is still in flight — the
  // refetch that follows that write reconciles instead.
  const REFRESH_TIMEOUT_MS = 10_000;
  let latestRefresh = 0;
  let pendingWrites = 0;
  // Set when the API says we're logged out (e.g. on the login page, where
  // shared components still mount) — not worth retrying or toasting.
  let unauthorized = false;

  function emit() {
    for (const listener of listeners) listener();
  }

  function setStore(next: T[]) {
    store = next;
    emit();
  }

  /** Resolves true if the list was fetched (even if a newer fetch superseded it). */
  async function refresh(): Promise<boolean> {
    const id = ++latestRefresh;
    try {
      // A request that hangs (rather than fails) would otherwise leave the
      // list stuck on its loading skeleton; give up on it so it's retried.
      const res = await fetch(typeof endpoint === "function" ? endpoint() : endpoint, {
        cache: "no-store",
        signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
      });
      unauthorized = res.status === 401;
      if (unauthorized && offlineKey) clearOfflineCopy(offlineKey);
      if (!res.ok) throw new Error(String(res.status));
      const next = fromResponse(await res.json());
      if (id === latestRefresh && pendingWrites === 0) {
        setStore(next);
        if (offlineKey) saveOfflineCopy(offlineKey, next);
      }
      return true;
    } catch {
      // Keep the last good cache; the next successful call resyncs it. No
      // toast here — a background refetch failing is less actionable than a
      // user-initiated write failing.
      return false;
    }
  }

  // A failed first load used to leave the list silently empty for the rest
  // of the visit. Retry a few times before giving up, and refetch whenever
  // the tab regains focus or the connection comes back.
  const RETRY_DELAYS_MS = [1000, 3000, 8000];

  function listenForReconnect() {
    const resync = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", resync);
  }

  async function hydrate() {
    let ok = await refresh();
    for (const delay of RETRY_DELAYS_MS) {
      if (ok || unauthorized) break;
      await new Promise((resolve) => setTimeout(resolve, delay));
      ok = await refresh();
    }
    if (ok || unauthorized) return;
    const saved = offlineKey ? loadOfflineCopy<T>(offlineKey) : null;
    if (saved) {
      // Show the last copy read-only-ish: the next successful refetch (on
      // reconnect or tab focus) replaces it.
      setStore(saved.items);
      pushToast(
        `Offline — showing your ${noun}s as of ${describeAge(saved.savedAt)}.`,
        "info",
        8000
      );
    } else {
      pushToast(`Couldn't load your ${noun}s — check your connection, then switch back to this tab.`);
    }
  }

  function ensureHydrated() {
    if (hydrated || hydrating || typeof window === "undefined") return;
    hydrating = true;
    listenForReconnect();
    hydrate().finally(() => {
      hydrated = true;
      hydrating = false;
      emit();
    });
  }

  function mutate(
    optimistic: (current: T[]) => T[],
    send: () => Promise<Response>,
    opts?: { action?: string; afterRefresh?: () => void }
  ) {
    setStore(optimistic(store));
    pendingWrites++;
    Promise.resolve()
      .then(send)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
      })
      .catch(() => {
        pushToast(`Couldn't ${opts?.action ?? "save"} that ${noun} — your change was undone.`);
      })
      .finally(() => {
        pendingWrites--;
        refresh().then(() => opts?.afterRefresh?.());
      });
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => store,
    getServerSnapshot: () => EMPTY,
    getHydratedSnapshot: () => hydrated,
    getServerHydratedSnapshot: () => false,
    ensureHydrated,
    refresh,
    getAll: () => store,
    mutate,
  };
}
