"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "stits:dashboard-sidebar-width";
export const MIN_SIDEBAR_WIDTH = 220;
export const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_WIDTH = 288;

function clamp(next: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, next));
}

let width = DEFAULT_WIDTH;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setWidth(next: number) {
  width = clamp(next);
  window.localStorage.setItem(STORAGE_KEY, String(width));
  emit();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  const stored = Number(window.localStorage.getItem(STORAGE_KEY));
  if (Number.isFinite(stored) && stored > 0) width = clamp(stored);
  hydrated = true;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): number {
  return width;
}

const SERVER_SNAPSHOT = DEFAULT_WIDTH;

export function useSidebarWidth() {
  useEffect(() => {
    ensureHydrated();
  }, []);

  const sidebarWidth = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  const setSidebarWidth = useCallback((next: number) => {
    setWidth(next);
  }, []);

  return { sidebarWidth, setSidebarWidth };
}
