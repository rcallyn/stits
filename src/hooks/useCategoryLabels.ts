"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { CATEGORIES, Category } from "@/lib/categories";
import {
  ensureSettingsHydrated,
  getSettingsSnapshot,
  patchSettings,
  subscribeSettings,
  useSettingsFallback,
} from "@/hooks/settingsStore";

export function useCategoryLabels() {
  useEffect(() => {
    ensureSettingsHydrated();
  }, []);

  const fallback = useSettingsFallback();
  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, () => fallback);

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
