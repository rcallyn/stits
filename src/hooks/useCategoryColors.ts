"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Category } from "@/lib/categories";

const STORAGE_KEY = "stits:category-colors";

type Overrides = Partial<Record<Category, string>>;

let store: Overrides = {};
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setStore(next: Overrides) {
  store = next;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  emit();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      store = JSON.parse(raw);
    } catch {
      store = {};
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

const EMPTY_OVERRIDES: Overrides = {};

export function useCategoryColors() {
  useEffect(() => {
    ensureHydrated();
  }, []);

  const overrides = useSyncExternalStore(subscribe, getStoreSnapshot, () => EMPTY_OVERRIDES);
  useSyncExternalStore(subscribe, getHydratedSnapshot, () => false);

  const setCategoryColor = useCallback((category: Category, colorKey: string) => {
    setStore({ ...store, [category]: colorKey });
  }, []);

  return { overrides, setCategoryColor };
}
