import { Category } from "@/lib/categories";

// `solid`/`strong`/`soft` must be full literal class strings — Tailwind's
// scanner only generates CSS for classes it can find verbatim in source, so
// these can't be built at runtime (e.g. via string replace) or the utility
// silently does nothing and the fill renders as fully transparent.
export type ColorStyle = {
  key: string;
  dot: string;
  solid: string; // ~90% opaque fill — plain events
  strong: string; // ~80% opaque fill — todos
  soft: string; // ~20% opaque fill — independent notes
};

// The full set of selectable colors — used both for auto-assigned item
// colors and as the palette a user picks from for a category.
export const COLOR_PALETTE: ColorStyle[] = [
  { key: "rose", dot: "bg-rose-500", solid: "bg-rose-500/90 text-white", strong: "bg-rose-500/80 text-white", soft: "bg-rose-500/20 text-foreground" },
  { key: "indigo", dot: "bg-indigo-500", solid: "bg-indigo-500/90 text-white", strong: "bg-indigo-500/80 text-white", soft: "bg-indigo-500/20 text-foreground" },
  { key: "sky", dot: "bg-sky-500", solid: "bg-sky-500/90 text-white", strong: "bg-sky-500/80 text-white", soft: "bg-sky-500/20 text-foreground" },
  { key: "emerald", dot: "bg-emerald-500", solid: "bg-emerald-500/90 text-white", strong: "bg-emerald-500/80 text-white", soft: "bg-emerald-500/20 text-foreground" },
  { key: "amber", dot: "bg-amber-500", solid: "bg-amber-500/90 text-white", strong: "bg-amber-500/80 text-white", soft: "bg-amber-500/20 text-foreground" },
  { key: "fuchsia", dot: "bg-fuchsia-500", solid: "bg-fuchsia-500/90 text-white", strong: "bg-fuchsia-500/80 text-white", soft: "bg-fuchsia-500/20 text-foreground" },
  { key: "cyan", dot: "bg-cyan-500", solid: "bg-cyan-500/90 text-white", strong: "bg-cyan-500/80 text-white", soft: "bg-cyan-500/20 text-foreground" },
  { key: "orange", dot: "bg-orange-500", solid: "bg-orange-500/90 text-white", strong: "bg-orange-500/80 text-white", soft: "bg-orange-500/20 text-foreground" },
  { key: "lime", dot: "bg-lime-600", solid: "bg-lime-600/90 text-white", strong: "bg-lime-600/80 text-white", soft: "bg-lime-600/20 text-foreground" },
  { key: "pink", dot: "bg-pink-500", solid: "bg-pink-500/90 text-white", strong: "bg-pink-500/80 text-white", soft: "bg-pink-500/20 text-foreground" },
  { key: "teal", dot: "bg-teal-500", solid: "bg-teal-500/90 text-white", strong: "bg-teal-500/80 text-white", soft: "bg-teal-500/20 text-foreground" },
  { key: "violet", dot: "bg-violet-500", solid: "bg-violet-500/90 text-white", strong: "bg-violet-500/80 text-white", soft: "bg-violet-500/20 text-foreground" },
  { key: "slate", dot: "bg-slate-500", solid: "bg-slate-500/90 text-white", strong: "bg-slate-500/80 text-white", soft: "bg-slate-500/20 text-foreground" },
  { key: "red", dot: "bg-red-500", solid: "bg-red-500/90 text-white", strong: "bg-red-500/80 text-white", soft: "bg-red-500/20 text-foreground" },
  { key: "blue", dot: "bg-blue-500", solid: "bg-blue-500/90 text-white", strong: "bg-blue-500/80 text-white", soft: "bg-blue-500/20 text-foreground" },
  { key: "green", dot: "bg-green-500", solid: "bg-green-500/90 text-white", strong: "bg-green-500/80 text-white", soft: "bg-green-500/20 text-foreground" },
];

const PALETTE_BY_KEY = new Map(COLOR_PALETTE.map((c) => [c.key, c]));

export const DEFAULT_CATEGORY_COLOR_KEY: Record<Category, string> = {
  rush: "rose",
  career: "indigo",
  school: "sky",
  house: "slate",
  other: "violet",
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Cycled through automatically for items without a category, so distinct
// todos/events read as visually distinct without anyone picking colors.
export function autoColorFor(seed: string): ColorStyle {
  return COLOR_PALETTE[hashString(seed) % COLOR_PALETTE.length];
}

export function colorByKey(key: string): ColorStyle {
  return PALETTE_BY_KEY.get(key) ?? COLOR_PALETTE[0];
}

// Category color wins when set (explicit, meaningful grouping, and
// user-customizable via `categoryColors`); otherwise every item gets its own
// stable, automatically-picked color.
export function resolveColor(
  seed: string,
  category?: Category,
  categoryColors?: Partial<Record<Category, string>>
): ColorStyle {
  if (category) {
    return colorByKey(categoryColors?.[category] ?? DEFAULT_CATEGORY_COLOR_KEY[category]);
  }
  return autoColorFor(seed);
}
