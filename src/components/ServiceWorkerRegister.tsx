"use client";

import { useEffect } from "react";

// Registers /public/sw.js after load. The worker itself is intentionally
// small (see the file for why) — this just wires it up in production.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // If this page was already controlled by a worker and a *new* one takes
    // over (i.e. a fixed worker replacing a broken one), reload once so the
    // page is served by the new worker. Guarded on `hadController` so a
    // first-ever visit — where the first worker claims an uncontrolled page —
    // doesn't trigger a spurious reload.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    const onControllerChange = () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration just means no offline fallback; nothing else
        // depends on it.
      });
    };
    window.addEventListener("load", onLoad);

    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
