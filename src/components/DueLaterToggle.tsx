"use client";

type Props = {
  count: number;
  expanded: boolean;
  onToggle: () => void;
};

// The "+N due later" button under a list trimmed by splitDueLater.
export default function DueLaterToggle({ count, expanded, onToggle }: Props) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="mt-2 rounded-full bg-black/[.05] px-3 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-black/[.08] hover:text-foreground dark:bg-white/[.08] dark:text-zinc-400 dark:hover:bg-white/[.12]"
    >
      {expanded ? `Hide ${count} due later` : `+${count} due later`}
    </button>
  );
}
