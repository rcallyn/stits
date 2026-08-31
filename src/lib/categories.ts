export type Category = "rush" | "career" | "school" | "house" | "other";

export type CategoryMeta = {
  label: string;
};

export const CATEGORIES: Record<Category, CategoryMeta> = {
  rush: { label: "Rush" },
  career: { label: "Career" },
  school: { label: "School" },
  house: { label: "House Management" },
  other: { label: "Other" },
};

export const CATEGORY_LIST = Object.entries(CATEGORIES) as [Category, CategoryMeta][];

export function isCategory(value: string): value is Category {
  return value in CATEGORIES;
}
