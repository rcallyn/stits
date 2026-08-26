"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Category } from "@/lib/categories";
import {
  EMPTY_SETTINGS,
  ensureSettingsHydrated,
  getSettingsSnapshot,
  patchSettings,
  subscribeSettings,
} from "@/hooks/settingsStore";

export function useCategoryColors() {
  useEffect(() => {
    ensureSettingsHydrated();
  }, []);

  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, () => EMPTY_SETTINGS);

  const setCategoryColor = useCallback((category: Category, colorKey: string) => {
    patchSettings({
      categoryColors: { ...getSettingsSnapshot().categoryColors, [category]: colorKey },
    });
  }, []);

  return { overrides: settings.categoryColors, setCategoryColor };
}
