"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { CATEGORIES, Category } from "@/lib/categories";
import {
  EMPTY_SETTINGS,
  ensureSettingsHydrated,
  getSettingsSnapshot,
  patchSettings,
  subscribeSettings,
} from "@/hooks/settingsStore";

export function useCategoryLabels() {
  useEffect(() => {
    ensureSettingsHydrated();
  }, []);

  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, () => EMPTY_SETTINGS);

  const labelFor = useCallback(
    (category: Category) => settings.categoryLabels[category] ?? CATEGORIES[category].label,
    [settings]
  );

  const setCategoryLabel = useCallback((category: Category, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    patchSettings({
      categoryLabels: { ...getSettingsSnapshot().categoryLabels, [category]: trimmed },
    });
  }, []);

  return { labelFor, setCategoryLabel };
}
