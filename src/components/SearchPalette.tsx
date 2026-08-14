"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTodos } from "@/hooks/useTodos";
import { useNotes } from "@/hooks/useNotes";
import { useScheduleEvents } from "@/hooks/useScheduleEvents";
import { useJumpToDate } from "@/hooks/useJumpToDate";
import { useSearchPalette } from "@/hooks/useSearchPalette";
import { formatEventDate, truncateForTitle } from "@/lib/schedule";

type Result = {
  kind: "todo" | "note" | "event";
  id: string;
  title: string;
  sub?: string;
  date?: string;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export default function SearchPalette() {
  const { isOpen, setOpen } = useSearchPalette();
  const [query, setQuery] = useState("");
  const [wasOpen, setWasOpen] = useState(isOpen);
  const { todos } = useTodos();
  const { notes } = useNotes();
  const { events } = useScheduleEvents();
  const { setJumpToDate } = useJumpToDate();
  const router = useRouter();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!isOpen);
        return;
      }
      if (isOpen && e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!isOpen && e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        document.getElementById("quick-add-input")?.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, setOpen]);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setQuery("");
  }

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const todoResults: Result[] = todos
      .filter((t) => t.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map((t) => ({
        kind: "todo",
        id: t.id,
        title: t.title,
        sub: t.dueDate ? `Due ${formatEventDate(t.dueDate)}` : undefined,
      }));
    const eventResults: Result[] = events
      .filter((e) => e.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map((e) => ({ kind: "event", id: e.id, title: e.title, sub: formatEventDate(e.date), date: e.date }));
    const noteResults: Result[] = notes
      .filter((n) => n.text.toLowerCase().includes(q))
      .slice(0, 6)
      .map((n) => ({ kind: "note", id: n.id, title: truncateForTitle(n.text, 70) }));

    return [...todoResults, ...eventResults, ...noteResults];
  }, [query, todos, notes, events]);

  function handleSelect(result: Result) {
    setOpen(false);
    if (result.kind === "todo") {
      router.push("/todos");
    } else if (result.kind === "note") {
      router.push("/other");
    } else if (result.date) {
      setJumpToDate(result.date);
      router.push("/");
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-black/[.08] bg-background shadow-2xl dark:border-white/[.145]"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search todos, notes, and events…"
          className="w-full border-b border-black/[.08] bg-transparent px-4 py-3 text-sm outline-none dark:border-white/[.145]"
        />
        {query.trim() && (
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No matches.
              </p>
            ) : (
              results.map((result) => (
                <button
                  key={`${result.kind}-${result.id}`}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                >
                  <span className="shrink-0 rounded bg-black/[.06] px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-500 dark:bg-white/[.1] dark:text-zinc-400">
                    {result.kind}
                  </span>
                  <span className="flex-1 truncate">{result.title}</span>
                  {result.sub && <span className="shrink-0 text-xs text-zinc-400">{result.sub}</span>}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
