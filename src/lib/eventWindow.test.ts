import { describe, expect, it } from "vitest";
import { covers, defaultWindow, eventsUrl, widenWindow } from "@/lib/eventWindow";

describe("eventWindow", () => {
  const win = defaultWindow("2026-10-19");

  it("spans a lookback and lookahead around today", () => {
    expect(win).toEqual({ from: "2026-08-20", to: "2027-02-16" });
  });

  it("leaves the window alone when the range is already covered", () => {
    expect(covers(win, "2026-10-01", "2026-11-10")).toBe(true);
    expect(widenWindow(win, "2026-10-01", "2026-11-10")).toBe(win);
  });

  it("widens only the side that is exceeded, with padding", () => {
    const earlier = widenWindow(win, "2026-06-01", "2026-06-30");
    expect(earlier.to).toBe(win.to);
    expect(earlier.from).toBe("2026-04-17");
    const later = widenWindow(win, "2027-03-01", "2027-03-31");
    expect(later.from).toBe(win.from);
    expect(later.to).toBe("2027-05-15");
    expect(covers(later, "2027-03-01", "2027-03-31")).toBe(true);
  });

  it("builds the query url", () => {
    expect(eventsUrl(win)).toBe("/api/events?from=2026-08-20&to=2027-02-16");
  });
});
