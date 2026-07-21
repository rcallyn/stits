import { Category, CATEGORIES } from "@/lib/categories";

type ColorStyle = { dot: string; block: string };

// Cycled through automatically for items without a category, so distinct
// todos/events read as visually distinct without anyone picking colors.
const AUTO_PALETTE: ColorStyle[] = [
  { dot: "bg-rose-500", block: "bg-rose-500/90 text-white" },
  { dot: "bg-indigo-500", block: "bg-indigo-500/90 text-white" },
  { dot: "bg-sky-500", block: "bg-sky-500/90 text-white" },
  { dot: "bg-emerald-500", block: "bg-emerald-500/90 text-white" },
  { dot: "bg-amber-500", block: "bg-amber-500/90 text-white" },
  { dot: "bg-fuchsia-500", block: "bg-fuchsia-500/90 text-white" },
  { dot: "bg-cyan-500", block: "bg-cyan-500/90 text-white" },
  { dot: "bg-orange-500", block: "bg-orange-500/90 text-white" },
  { dot: "bg-lime-600", block: "bg-lime-600/90 text-white" },
  { dot: "bg-pink-500", block: "bg-pink-500/90 text-white" },
  { dot: "bg-teal-500", block: "bg-teal-500/90 text-white" },
  { dot: "bg-violet-500", block: "bg-violet-500/90 text-white" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function autoColorFor(seed: string): ColorStyle {
  return AUTO_PALETTE[hashString(seed) % AUTO_PALETTE.length];
}

// Category color wins when set (explicit, meaningful grouping); otherwise
// every item gets its own stable, automatically-picked color.
export function resolveColor(seed: string, category?: Category): ColorStyle {
  if (category) return CATEGORIES[category];
  return autoColorFor(seed);
}
