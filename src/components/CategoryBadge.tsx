"use client";

import { Category } from "@/lib/categories";
import { useCategoryColors } from "@/hooks/useCategoryColors";
import { useCategoryLabels } from "@/hooks/useCategoryLabels";
import { resolveColor } from "@/lib/itemColor";

type Props = {
  category: Category;
  className?: string;
};

export default function CategoryBadge({ category, className = "" }: Props) {
  const { overrides } = useCategoryColors();
  const { labelFor } = useCategoryLabels();
  const color = resolveColor(category, category, overrides);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-black/[.06] px-2 py-0.5 text-[11px] font-medium dark:bg-white/[.1] ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
      {labelFor(category)}
    </span>
  );
}
