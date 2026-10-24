"use client";

import { buildDemoData, DemoData } from "@/lib/demo/demoData";
import { handleDemoRequest } from "@/lib/demo/demoApi";
import { DEMO_COOKIE_NAME } from "@/lib/demo/demoMode";
import { todayISODate } from "@/lib/schedule";
import { primeSettings } from "@/hooks/settingsStore";

// Demo mode swaps window.fetch for a version that answers same-origin /api
// calls from demoApi instead of the network, so every store, hook and page
// runs as it does for a signed-in user. The sample data lives in
// sessionStorage: it survives reloads in this tab and is gone when the tab
// closes, and nothing a visitor does reaches the server.

const STORAGE_KEY = "stits:demo-data";

export function isDemoCookieSet(): boolean {
  return document.cookie.split("; ").some((c) => c === `${DEMO_COOKIE_NAME}=1`);
}

function loadState(): DemoData {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as DemoData;
  } catch {
    // Storage blocked or corrupt — start from fresh sample data.
  }
  return buildDemoData(todayISODate());
}

function saveState(state: DemoData) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Without storage the demo still works; changes just don't survive a reload.
  }
}

let installed = false;

export function installDemoFetch() {
  if (installed) return;
  installed = true;
  const state = loadState();
  saveState(state);
  primeSettings(state.settings);
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
      return realFetch(input, init);
    }

    const method = init?.method ?? request?.method ?? "GET";
    const rawBody = typeof init?.body === "string" ? init.body : request ? await request.text() : "";
    let body: unknown;
    try {
      body = rawBody ? JSON.parse(rawBody) : undefined;
    } catch {
      body = undefined;
    }

    const result = handleDemoRequest(state, method, url.pathname, body);
    if (method.toUpperCase() !== "GET") saveState(state);
    if (url.pathname === "/api/logout") clearDemo();
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

function clearDemo() {
  document.cookie = `${DEMO_COOKIE_NAME}=; path=/; max-age=0`;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Throws away the visitor's changes and reloads with fresh sample data. */
export function resetDemo() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
  window.location.reload();
}

/** Leaves demo mode: back to the login page (or a signed-in user's own data). */
export function exitDemo() {
  clearDemo();
  // A full page load so the patched fetch and the sample data are dropped.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/";
}
