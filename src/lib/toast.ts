"use client";

// Tiny pub/sub for transient toast messages. It lives outside React so the
// module-level entity stores (which run their fetches outside any component)
// can report a failed save without threading a callback through every hook.

export type ToastKind = "error" | "info";
export type Toast = { id: string; kind: ToastKind; message: string };

let toasts: Toast[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts() {
  return toasts;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function pushToast(message: string, kind: ToastKind = "error", ttlMs = 6000) {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
  toasts = [...toasts, { id, kind, message }];
  emit();
  if (ttlMs > 0 && typeof window !== "undefined") {
    window.setTimeout(() => dismissToast(id), ttlMs);
  }
}
