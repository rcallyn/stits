import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts, pushToast, subscribeToasts } from "@/lib/toast";

function clearAll() {
  for (const t of getToasts()) dismissToast(t.id);
}

describe("toast store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The node test environment has no window; the auto-dismiss timer needs one.
    vi.stubGlobal("window", { setTimeout: globalThis.setTimeout });
  });
  afterEach(() => {
    clearAll();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("adds a toast, defaulting to the error kind", () => {
    pushToast("Save failed");
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toMatchObject({ kind: "error", message: "Save failed" });
  });

  it("notifies subscribers on push and dismiss, and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToasts(listener);
    pushToast("hello", "info", 0);
    expect(listener).toHaveBeenCalledTimes(1);
    dismissToast(getToasts()[0].id);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    pushToast("again", "info", 0);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("gives each toast a distinct id and dismisses only the one asked for", () => {
    pushToast("a", "info", 0);
    pushToast("b", "info", 0);
    const [a, b] = getToasts();
    expect(a.id).not.toBe(b.id);
    dismissToast(a.id);
    expect(getToasts().map((t) => t.message)).toEqual(["b"]);
  });

  it("auto-dismisses after the ttl, but never when ttl is 0", () => {
    pushToast("temporary", "error", 1000);
    pushToast("sticky", "error", 0);
    vi.advanceTimersByTime(999);
    expect(getToasts()).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(getToasts().map((t) => t.message)).toEqual(["sticky"]);
    vi.advanceTimersByTime(60_000);
    expect(getToasts().map((t) => t.message)).toEqual(["sticky"]);
  });

  it("carries an optional action and returns it untouched", () => {
    const run = vi.fn();
    pushToast("Deleted “x”.", "info", 0, { label: "Undo", run });
    pushToast("plain", "info", 0);
    const [withAction, plain] = getToasts();
    expect(withAction.action?.label).toBe("Undo");
    withAction.action?.run();
    expect(run).toHaveBeenCalledTimes(1);
    expect(plain.action).toBeUndefined();
  });
});
