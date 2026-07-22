"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Category, CATEGORY_LIST } from "@/lib/categories";

const STORAGE_KEY = "stits:category-order";
const DEFAULT_ORDER: Category[] = CATEGORY_LIST.map(([key]) => key);

let store: Category[] = DEFAULT_ORDER;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setStore(next: Category[]) {
  store = next;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  emit();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed: Category[] = JSON.parse(raw);
      const valid = parsed.filter((c) => DEFAULT_ORDER.includes(c));
      const missing = DEFAULT_ORDER.filter((c) => !valid.includes(c));
      store = [...valid, ...missing];
    } catch {
      store = DEFAULT_ORDER;
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

export function useCategoryOrder() {
  useEffect(() => {
    ensureHydrated();
  }, []);

  const order = useSyncExternalStore(subscribe, getStoreSnapshot, () => DEFAULT_ORDER);
  useSyncExternalStore(subscribe, getHydratedSnapshot, () => false);

  const moveCategory = useCallback((dragged: Category, target: Category) => {
    if (dragged === target) return;
    const next = [...store];
    const from = next.indexOf(dragged);
    const to = next.indexOf(target);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, dragged);
    setStore(next);
  }, []);

  return { order, moveCategory };
}
