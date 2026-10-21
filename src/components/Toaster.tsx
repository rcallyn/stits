"use client";

import { useSyncExternalStore } from "react";
import { dismissToast, getToasts, subscribeToasts } from "@/lib/toast";

const EMPTY: ReturnType<typeof getToasts> = [];

// Renders the transient messages pushed through lib/toast — mostly "couldn't
// save" notices from the entity stores, which previously failed silently.
export default function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, () => EMPTY);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-6"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-2.5 text-sm shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur ${
            toast.kind === "error"
              ? "bg-red-600/95 text-white"
              : "bg-zinc-900/95 text-white dark:bg-zinc-100/95 dark:text-zinc-900"
          }`}
        >
          <button type="button" onClick={() => dismissToast(toast.id)} className="text-left">
            {toast.message}
          </button>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                dismissToast(toast.id);
                toast.action?.run();
              }}
              className="shrink-0 rounded-md px-2 py-0.5 font-semibold underline underline-offset-2 hover:opacity-80"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
