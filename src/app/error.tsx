"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        This page hit an unexpected error. It&apos;s been logged — try again, or head back to the
        Dashboard.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="h-10 rounded-lg bg-[#0071e3] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0077ed] active:bg-[#006edb]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="flex h-10 items-center rounded-lg border border-black/[.12] px-4 text-sm font-medium transition-colors hover:bg-black/[.03] dark:border-white/[.145] dark:hover:bg-white/[.06]"
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
