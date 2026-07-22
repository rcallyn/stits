"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

// Tracks a note "picked up" on the Other tab so it can be placed onto the
// schedule after navigating to the Dashboard. sessionStorage (not
// localStorage) since this is transient UI state, not data worth keeping
// across browser restarts.
const STORAGE_KEY = "stits:pending-note-id";

let pendingId: string | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setPending(id: string | null) {
  pendingId = id;
  if (id) {
    window.sessionStorage.setItem(STORAGE_KEY, id);
  } else {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
  emit();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  pendingId = window.sessionStorage.getItem(STORAGE_KEY);
  hydrated = true;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return pendingId;
}

export function usePendingNoteId() {
  useEffect(() => {
    ensureHydrated();
  }, []);

  const pendingNoteId = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const setPendingNoteId = useCallback((id: string | null) => {
    setPending(id);
  }, []);

  return { pendingNoteId, setPendingNoteId };
}
