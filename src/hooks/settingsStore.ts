"use client";

// Shared client-side cache for the single `settings` row — backs
// useCategoryColors, useCategoryLabels, useCategoryOrder, and
// useCanvasSettings so loading the app fires one /api/settings request
// instead of four. Not a hook itself; each of those hooks wraps this with
// useSyncExternalStore and exposes its own slice + public API.

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
