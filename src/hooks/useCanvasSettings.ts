"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  ensureSettingsHydrated,
  getSettingsHydratedSnapshot,
  getSettingsSnapshot,
  patchSettings,
  subscribeSettings,
  useSettingsFallback,
} from "@/hooks/settingsStore";

export type CanvasSettings = {
  feedUrl: string;
  lastSyncedAt?: string;
};

export function useCanvasSettings() {
  useEffect(() => {
    ensureSettingsHydrated();
  }, []);

  const fallback = useSettingsFallback();
  const raw = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, () => fallback);
  const loaded = useSyncExternalStore(subscribeSettings, getSettingsHydratedSnapshot, () => false);
  const settings: CanvasSettings = { feedUrl: raw.canvasFeedUrl, lastSyncedAt: raw.canvasLastSyncedAt };

  const updateSettings = useCallback((changes: Partial<CanvasSettings>) => {
    const patch: Partial<{ canvasFeedUrl: string; canvasLastSyncedAt: string }> = {};
    if (changes.feedUrl !== undefined) patch.canvasFeedUrl = changes.feedUrl;
    if (changes.lastSyncedAt !== undefined) patch.canvasLastSyncedAt = changes.lastSyncedAt;
    patchSettings(patch);
  }, []);

  return { settings, loaded, updateSettings };
}
