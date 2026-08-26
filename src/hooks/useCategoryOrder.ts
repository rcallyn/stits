"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Category, CATEGORY_LIST } from "@/lib/categories";
import {
  EMPTY_SETTINGS,
  ensureSettingsHydrated,
  getSettingsSnapshot,
  patchSettings,
  subscribeSettings,
} from "@/hooks/settingsStore";

const DEFAULT_ORDER: Category[] = CATEGORY_LIST.map(([key]) => key);

export function useCategoryOrder() {
  useEffect(() => {
    ensureSettingsHydrated();
  }, []);

  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, () => EMPTY_SETTINGS);
  const stored = settings.categoryOrder;
  const order =
    stored.length > 0
      ? [...stored.filter((c) => DEFAULT_ORDER.includes(c)), ...DEFAULT_ORDER.filter((c) => !stored.includes(c))]
      : DEFAULT_ORDER;

  const moveCategory = useCallback((dragged: Category, target: Category) => {
    if (dragged === target) return;
    const current = getSettingsSnapshot().categoryOrder;
    const base = current.length > 0 ? current : DEFAULT_ORDER;
    const next = [...base];
    const from = next.indexOf(dragged);
    const to = next.indexOf(target);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, dragged);
    patchSettings({ categoryOrder: next });
  }, []);

  return { order, moveCategory };
}
