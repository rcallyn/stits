"use client";

import { useEffect } from "react";

// Registers /public/sw.js after load. The worker itself is intentionally
// small (see the file for why) — this just wires it up in production.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration just means no offline fallback; nothing else
        // depends on it.
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
