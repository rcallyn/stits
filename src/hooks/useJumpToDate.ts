"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

// Tracks a date "requested" from the Calendar tab so the Dashboard can jump
// straight to it after navigating. sessionStorage (not localStorage) since
// this is transient UI state, not data worth keeping across browser restarts.
const STORAGE_KEY = "stits:jump-to-date";

let jumpDate: string | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setJump(date: string | null) {
  jumpDate = date;
  if (date) {
    window.sessionStorage.setItem(STORAGE_KEY, date);
  } else {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
  emit();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  jumpDate = window.sessionStorage.getItem(STORAGE_KEY);
  hydrated = true;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return jumpDate;
}

export function useJumpToDate() {
  useEffect(() => {
    ensureHydrated();
  }, []);

  const jumpToDate = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const setJumpToDate = useCallback((date: string | null) => {
    setJump(date);
  }, []);

  return { jumpToDate, setJumpToDate };
}
