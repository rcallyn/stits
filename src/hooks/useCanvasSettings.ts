"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "stits:canvas-settings";

export type CanvasSettings = {
  feedUrl: string;
  lastSyncedAt?: string;
};

const EMPTY: CanvasSettings = { feedUrl: "" };

let store: CanvasSettings = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setStore(next: CanvasSettings) {
  store = next;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  emit();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      store = { ...EMPTY, ...JSON.parse(raw) };
    } catch {
      store = EMPTY;
    }
  }
  hydrated = true;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getStoreSnapshot() {
  return store;
}

function getHydratedSnapshot() {
  return hydrated;
}

export function useCanvasSettings() {
  useEffect(() => {
    ensureHydrated();
  }, []);

  const settings = useSyncExternalStore(subscribe, getStoreSnapshot, () => EMPTY);
  const loaded = useSyncExternalStore(subscribe, getHydratedSnapshot, () => false);

  const updateSettings = useCallback((changes: Partial<CanvasSettings>) => {
    setStore({ ...store, ...changes });
  }, []);

  return { settings, loaded, updateSettings };
}
