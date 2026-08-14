"use client";

import { useCallback, useSyncExternalStore } from "react";

// Pure in-memory UI state (not persisted) shared between the Nav trigger
// button and the palette itself, following the same external-store pattern
// used for the app's persisted hooks.
let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return open;
}

export function useSearchPalette() {
  const isOpen = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const setOpen = useCallback((next: boolean) => {
    open = next;
    emit();
  }, []);

  return { isOpen, setOpen };
}
