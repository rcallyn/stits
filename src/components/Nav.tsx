"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemePreference, useTheme } from "@/hooks/useTheme";
import { useSearchPalette } from "@/hooks/useSearchPalette";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/schedule", label: "Schedule" },
  { href: "/todos", label: "Todos" },
  { href: "/other", label: "Other" },
];

const THEME_ORDER: ThemePreference[] = ["system", "light", "dark"];
const THEME_ICON: Record<ThemePreference, string> = { system: "🖥️", light: "☀️", dark: "🌙" };

export default function Nav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { setOpen: setSearchOpen } = useSearchPalette();

  return (
    <header className="border-b border-black/[.08] dark:border-white/[.145]">
      <nav className="mx-auto flex max-w-3xl items-center gap-6 px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          stits
        </Link>
        <div className="flex flex-1 gap-4 text-sm">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={
                  active
                    ? "font-medium text-foreground"
                    : "text-zinc-500 hover:text-foreground dark:text-zinc-400"
                }
              >
                {label}
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          title="Search (Ctrl/Cmd+K)"
          className="rounded-md px-2 py-1 text-sm text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
        >
          🔍
        </button>
        <button
          type="button"
          onClick={() => setTheme(THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length])}
          aria-label={`Theme: ${theme}. Click to change.`}
          title={`Theme: ${theme}`}
          className="rounded-md px-1.5 py-1 text-sm text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
        >
          {THEME_ICON[theme]}
        </button>
      </nav>
    </header>
  );
}
