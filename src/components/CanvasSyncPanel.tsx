"use client";

import { useState } from "react";
import { useCanvasSettings } from "@/hooks/useCanvasSettings";
import { useCanvasSync } from "@/hooks/useCanvasSync";

const fieldClass =
  "rounded-[10px] border border-black/[.06] bg-black/[.025] px-3 py-2 text-sm outline-none transition-colors focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 dark:border-white/[.08] dark:bg-white/[.05] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]/20";

export default function CanvasSyncPanel() {
  const { settings, loaded, updateSettings } = useCanvasSettings();
  const { sync, syncing, error, lastResult } = useCanvasSync();
  const [feedUrl, setFeedUrl] = useState("");
  const [fieldsHydrated, setFieldsHydrated] = useState(false);

  if (loaded && !fieldsHydrated) {
    setFeedUrl(settings.feedUrl);
    setFieldsHydrated(true);
  }

  function persist() {
    updateSettings({ feedUrl: feedUrl.trim() });
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-[0_2px_16px_rgba(0,0,0,0.08)] dark:bg-[#1c1c1e] dark:shadow-none">
      <h2 className="text-sm font-semibold">Canvas</h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Pulls assignment due dates and any course calendar events from your Canvas calendar feed into
        your Todos and Schedule, tagged School. Find your feed link in Canvas under Calendar → Calendar
        Feed (bottom of the sidebar) — no access token needed. Re-syncing refreshes titles/dates and
        removes items that no longer appear on Canvas. The link is stored only in this browser.
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Calendar feed URL
          <input
            type="text"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            onBlur={persist}
            placeholder="https://yourschool.instructure.com/feeds/calendars/user_xxxxx.ics"
            className={fieldClass}
          />
        </label>
        <button
          type="button"
          onClick={async () => {
            persist();
            await sync({ feedUrl: feedUrl.trim() });
          }}
          disabled={syncing}
          className="h-10 shrink-0 rounded-lg bg-[#0071e3] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0077ed] active:bg-[#006edb] disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {lastResult && !error && (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Synced: {lastResult.added} added, {lastResult.updated} updated, {lastResult.removed} removed.
        </p>
      )}
      {settings.lastSyncedAt && (
        <p className="mt-1 text-xs text-zinc-400">
          Last synced {new Date(settings.lastSyncedAt).toLocaleString()}
        </p>
      )}
    </section>
  );
}
