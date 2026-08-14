"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";
const STORAGE_KEY = "stits:theme";

let theme: ThemePreference = "system";
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function applyTheme(next: ThemePreference) {
  theme = next;
  if (next === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", next);
  }
  window.localStorage.setItem(STORAGE_KEY, next);
  emit();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") theme = stored;
  hydrated = true;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ThemePreference {
  return theme;
}

const SERVER_SNAPSHOT: ThemePreference = "system";

export function useTheme() {
  useEffect(() => {
    ensureHydrated();
  }, []);

  const themePreference = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  const setTheme = useCallback((next: ThemePreference) => {
    applyTheme(next);
  }, []);

  return { theme: themePreference, setTheme };
}
