"use client";

import { pushToast } from "@/lib/toast";

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
  refresh: () => Promise<void>;
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
  endpoint: string;
  /** Pull the list out of the GET response envelope and sort it. */
  fromResponse: (data: unknown) => T[];
  /** Human noun for error toasts, e.g. "todo". */
  noun: string;
}): EntityStore<T> {
  const { endpoint, fromResponse, noun } = config;

  let store: T[] = [];
  let hydrated = false;
  let hydrating = false;
  const listeners = new Set<() => void>();
  const EMPTY: T[] = [];

  function emit() {
    for (const listener of listeners) listener();
  }

  function setStore(next: T[]) {
    store = next;
    emit();
  }

  async function refresh(): Promise<void> {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(String(res.status));
      setStore(fromResponse(await res.json()));
    } catch {
      // Keep the last good cache; the next successful call resyncs it. No
      // toast here — a background refetch failing is less actionable than a
      // user-initiated write failing.
    }
  }

  function ensureHydrated() {
    if (hydrated || hydrating || typeof window === "undefined") return;
    hydrating = true;
    refresh().finally(() => {
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
    Promise.resolve()
      .then(send)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
      })
      .catch(() => {
        pushToast(`Couldn't ${opts?.action ?? "save"} that ${noun} — your change was undone.`);
      })
      .finally(() => {
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
