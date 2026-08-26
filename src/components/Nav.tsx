"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { setOpen: setSearchOpen } = useSearchPalette();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 bg-black/80 text-white [backdrop-filter:saturate(180%)_blur(20px)]">
      <nav className="mx-auto flex h-12 max-w-4xl items-center gap-6 px-6">
        <Link href="/" className="text-[13px] font-semibold tracking-tight text-white">
          stits
        </Link>
        <div className="flex flex-1 gap-5 text-[12px]">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={
                  active ? "text-white" : "text-white/70 transition-colors hover:text-white"
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
          className="rounded-md px-2 py-1 text-sm text-white/70 transition-colors hover:text-white"
        >
          🔍
        </button>
        <button
          type="button"
          onClick={() => setTheme(THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length])}
          aria-label={`Theme: ${theme}. Click to change.`}
          title={`Theme: ${theme}`}
          className="rounded-md px-1.5 py-1 text-sm text-white/70 transition-colors hover:text-white"
        >
          {THEME_ICON[theme]}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
          className="rounded-md px-2 py-1 text-[12px] text-white/70 transition-colors hover:text-white"
        >
          Log out
        </button>
      </nav>
    </header>
  );
}
