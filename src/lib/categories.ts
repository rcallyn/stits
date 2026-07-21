export type Category = "rush" | "career" | "school" | "house";

export type CategoryStyle = {
  label: string;
  dot: string; // small color hint used in plain badges
  block: string; // solid background for calendar blocks / schedule chips
};

export const CATEGORIES: Record<Category, CategoryStyle> = {
  rush: {
    label: "Rush",
    dot: "bg-rose-500",
    block: "bg-rose-500/90 text-white",
  },
  career: {
    label: "Career",
    dot: "bg-indigo-500",
    block: "bg-indigo-500/90 text-white",
  },
  school: {
    label: "School",
    dot: "bg-sky-500",
    block: "bg-sky-500/90 text-white",
  },
  house: {
    label: "House Management",
    dot: "bg-slate-500",
    block: "bg-slate-500/90 text-white",
  },
};

export const CATEGORY_LIST = Object.entries(CATEGORIES) as [Category, CategoryStyle][];

export function isCategory(value: string): value is Category {
  return value in CATEGORIES;
}
