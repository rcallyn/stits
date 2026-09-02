// Served by the service worker when a page navigation fails offline. Kept
// static and free of any user data — it's cached on the device.

export const metadata = { title: "Offline · stits" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        stits needs a connection to load your schedule, todos, and notes. It&apos;ll work again once
        you&apos;re back online.
      </p>
    </main>
  );
}
