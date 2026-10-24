"use client";

import { ReactNode } from "react";
import { SettingsFallbackContext } from "@/hooks/settingsStore";
import { DEMO_SETTINGS } from "@/lib/demo/demoData";
import { installDemoFetch, isDemoCookieSet, resetDemo } from "@/lib/demo/demoFetch";

// Installed while this module loads — before any page's effects run and
// fetch their data — so the very first /api request is already answered from
// the sample data. The layout only renders this banner in demo mode; the
// nav's "Exit demo" button leaves it.
if (typeof window !== "undefined" && isDemoCookieSet()) installDemoFetch();

export default function DemoBanner() {
  return (
    <div className="border-b border-[#0071e3]/20 bg-[#0071e3]/[.08] text-[13px] dark:border-[#2997ff]/20 dark:bg-[#2997ff]/[.12]">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-1 px-6 py-2">
        <p className="flex-1 text-zinc-700 dark:text-zinc-300">
          <span className="font-semibold text-foreground">Demo</span> — a sample student&rsquo;s week. Try
          checking off todos, dragging them onto the calendar, or quick add. Changes stay in this tab only.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetDemo}
            className="text-zinc-600 transition-colors hover:text-foreground dark:text-zinc-400"
          >
            Reset
          </button>
          {/* A full page load, not <Link>, so the proxy ends demo mode on the
              way in and the signup form talks to the real server. */}
          <a href="/signup" className="font-medium text-[#0071e3] hover:underline dark:text-[#2997ff]">
            Request an account
          </a>
        </div>
      </div>
    </div>
  );
}

/** Wraps the app in demo mode so server-rendered category names are the demo's own. */
export function DemoSettingsProvider({ children }: { children: ReactNode }) {
  return <SettingsFallbackContext value={DEMO_SETTINGS}>{children}</SettingsFallbackContext>;
}
