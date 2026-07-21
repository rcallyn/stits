import { Category, CATEGORIES } from "@/lib/categories";

type Props = {
  category: Category;
  className?: string;
};

export default function CategoryBadge({ category, className = "" }: Props) {
  const style = CATEGORIES[category];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-black/[.06] px-2 py-0.5 text-[11px] font-medium dark:bg-white/[.1] ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
