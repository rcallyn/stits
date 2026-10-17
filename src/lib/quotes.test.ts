import { describe, expect, it } from "vitest";
import { PRODUCTIVITY_QUOTES, quoteOfTheDay } from "@/lib/quotes";

describe("quoteOfTheDay", () => {
  it("returns the same quote for the same date", () => {
    expect(quoteOfTheDay("2026-03-14")).toBe(quoteOfTheDay("2026-03-14"));
  });

  it("always returns one of the listed quotes, across a full leap year", () => {
    for (let day = 0; day < 366; day++) {
      const iso = new Date(Date.UTC(2028, 0, 1 + day)).toISOString().slice(0, 10);
      expect(PRODUCTIVITY_QUOTES).toContain(quoteOfTheDay(iso));
    }
  });

  it("advances to the next quote on consecutive days", () => {
    const n = PRODUCTIVITY_QUOTES.length;
    // 2026-01-01 is day 1, so the index is 1 % n.
    expect(quoteOfTheDay("2026-01-01")).toBe(PRODUCTIVITY_QUOTES[1 % n]);
    expect(quoteOfTheDay("2026-01-02")).toBe(PRODUCTIVITY_QUOTES[2 % n]);
  });

  it("has no empty quotes or authors", () => {
    for (const q of PRODUCTIVITY_QUOTES) {
      expect(q.text.trim()).not.toBe("");
      expect(q.author.trim()).not.toBe("");
    }
  });
});
