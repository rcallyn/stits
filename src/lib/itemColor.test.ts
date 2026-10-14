import { describe, expect, it } from "vitest";
import {
  autoColorFor,
  colorByKey,
  COLOR_PALETTE,
  DEFAULT_CATEGORY_COLOR_KEY,
  resolveColor,
} from "@/lib/itemColor";

describe("COLOR_PALETTE", () => {
  it("has unique keys and every default category color exists", () => {
    const keys = COLOR_PALETTE.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of Object.values(DEFAULT_CATEGORY_COLOR_KEY)) {
      expect(keys).toContain(key);
    }
  });
});

describe("autoColorFor", () => {
  it("is stable for the same seed and always returns a palette entry", () => {
    expect(autoColorFor("dentist")).toBe(autoColorFor("dentist"));
    for (const seed of ["", "a", "lab report", "ü".repeat(500)]) {
      expect(COLOR_PALETTE).toContain(autoColorFor(seed));
    }
  });
});

describe("colorByKey", () => {
  it("looks up by key and falls back to the first color", () => {
    expect(colorByKey("teal").key).toBe("teal");
    expect(colorByKey("nope")).toBe(COLOR_PALETTE[0]);
  });
});

describe("resolveColor", () => {
  it("uses the category's default color when none is customized", () => {
    expect(resolveColor("x", "school").key).toBe(DEFAULT_CATEGORY_COLOR_KEY.school);
  });

  it("prefers a user-customized category color", () => {
    expect(resolveColor("x", "school", { school: "lime" }).key).toBe("lime");
    expect(resolveColor("x", "school", { house: "lime" }).key).toBe("sky");
  });

  it("falls back to the seed-derived color without a category", () => {
    expect(resolveColor("seed")).toBe(autoColorFor("seed"));
    expect(resolveColor("seed", undefined, { school: "lime" })).toBe(autoColorFor("seed"));
  });
});
