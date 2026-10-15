import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_LIST, isCategory } from "@/lib/categories";

describe("isCategory", () => {
  it("accepts every built-in category key", () => {
    for (const key of Object.keys(CATEGORIES)) {
      expect(isCategory(key)).toBe(true);
    }
  });

  it("rejects unknown keys and the empty string", () => {
    expect(isCategory("")).toBe(false);
    expect(isCategory("Rush")).toBe(false);
    expect(isCategory("gym")).toBe(false);
  });

  it("rejects names inherited from Object.prototype", () => {
    for (const key of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
      expect(isCategory(key)).toBe(false);
    }
  });
});

describe("CATEGORY_LIST", () => {
  it("lists every category once", () => {
    expect(CATEGORY_LIST.map(([key]) => key).sort()).toEqual(Object.keys(CATEGORIES).sort());
  });
});
