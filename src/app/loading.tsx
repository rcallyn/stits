// Shown during the dynamic server render of any route (every page is dynamic
// now that the root layout reads request headers for the CSP nonce).

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center p-12" role="status" aria-label="Loading">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/15 border-t-black/50 dark:border-white/20 dark:border-t-white/60" />
    </div>
  );
}
