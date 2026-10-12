"use client";

import { useCallback, useState } from "react";
import { todoStore } from "@/hooks/useTodos";
import { eventStore } from "@/hooks/useScheduleEvents";
import { refreshSettings } from "@/hooks/settingsStore";
import type { CanvasSyncResult } from "@/lib/canvasSync";

// The sync itself runs on the server (lib/canvasSync.ts) — the same code the
// daily cron uses — so this just triggers it and refetches what it changed.
export function useCanvasSync() {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CanvasSyncResult | null>(null);

  const sync = useCallback(async (feedUrl: string) => {
    if (!feedUrl.trim()) {
      setError("Add your Canvas calendar feed URL first.");
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/canvas-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedUrl: feedUrl.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Sync failed.");
        return;
      }
      setLastResult(data.result ?? null);
      await Promise.all([todoStore.refresh(), eventStore.refresh(), refreshSettings()]);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSyncing(false);
    }
  }, []);

  return { sync, syncing, error, lastResult };
}
