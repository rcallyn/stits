"use client";

// Shared client-side cache for the single `settings` row — backs
// useCategoryColors, useCategoryLabels, useCategoryOrder, and
// useCanvasSettings so loading the app fires one /api/settings request
// instead of four. Not a hook itself; each of those hooks wraps this with
// useSyncExternalStore and exposes its own slice + public API.

import { createContext, useContext } from "react";
import { Category } from "@/lib/categories";
import { pushToast } from "@/lib/toast";

export type SettingsPayload = {
  categoryColors: Partial<Record<Category, string>>;
  categoryLabels: Partial<Record<Category, string>>;
  categoryOrder: Category[];
  canvasFeedUrl: string;
  canvasLastSyncedAt?: string;
};

export const EMPTY_SETTINGS: SettingsPayload = {
  categoryColors: {},
  categoryLabels: {},
  categoryOrder: [],
  canvasFeedUrl: "",
};

// What a server render (and the hydration pass after it) shows before the
// real settings load: empty for a signed-in user, the sample settings in demo
// mode so the built-in category names never flash up there.
export const SettingsFallbackContext = createContext<SettingsPayload>(EMPTY_SETTINGS);

export function useSettingsFallback(): SettingsPayload {
  return useContext(SettingsFallbackContext);
}

let store: SettingsPayload = EMPTY_SETTINGS;
let hydrated = false;
let hydrating = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setStore(next: SettingsPayload) {
  store = next;
  emit();
}

async function refresh() {
  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setStore({ ...EMPTY_SETTINGS, ...data });
  } catch {
    // Leave the cache as-is on a network failure — the next successful
    // mutation's refresh will resync it.
  }
}

export function ensureSettingsHydrated() {
  if (hydrated || hydrating || typeof window === "undefined") return;
  hydrating = true;
  refresh().finally(() => {
    hydrated = true;
    hydrating = false;
    emit();
  });
}

export async function patchSettings(changes: Partial<SettingsPayload>) {
  setStore({ ...store, ...changes });
  try {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    pushToast("Couldn't save that setting — your change was undone.");
  } finally {
    await refresh();
  }
}

/** Fills the cache without a request — demo mode already has the settings in hand. */
export function primeSettings(settings: SettingsPayload) {
  hydrated = true;
  setStore(settings);
}

/** Refetch after a server-side change, e.g. a Canvas sync updating its timestamp. */
export function refreshSettings(): Promise<void> {
  return refresh();
}

export function subscribeSettings(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSettingsSnapshot(): SettingsPayload {
  return store;
}

export function getSettingsHydratedSnapshot(): boolean {
  return hydrated;
}
