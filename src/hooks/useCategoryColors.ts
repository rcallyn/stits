"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Category } from "@/lib/categories";
import {
  ensureSettingsHydrated,
  getSettingsSnapshot,
  patchSettings,
  subscribeSettings,
  useSettingsFallback,
} from "@/hooks/settingsStore";

export function useCategoryColors() {
  useEffect(() => {
    ensureSettingsHydrated();
  }, []);

  const fallback = useSettingsFallback();
  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, () => fallback);

  const setCategoryColor = useCallback((category: Category, colorKey: string) => {
    patchSettings({
      categoryColors: { ...getSettingsSnapshot().categoryColors, [category]: colorKey },
    });
  }, []);

  return { overrides: settings.categoryColors, setCategoryColor };
}
