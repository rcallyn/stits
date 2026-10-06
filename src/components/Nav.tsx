"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemePreference, useTheme } from "@/hooks/useTheme";
import { useSearchPalette } from "@/hooks/useSearchPalette";
import TabBarIcon, { TabIconName } from "@/components/TabBarIcon";

const links: { href: string; label: string; icon: TabIconName }[] = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/other", label: "Other", icon: "folder" },
];

// Apple's iOS-dark-mode system blue — the standard tint iOS uses for a
// selected tab bar item, chosen to read clearly against the tab bar's
// permanently-dark background.
const ACTIVE_TINT = "#0a84ff";

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
    <>
      <header className="sticky top-0 z-40 bg-black/80 text-white [backdrop-filter:saturate(180%)_blur(20px)]">
        <nav className="mx-auto flex h-12 max-w-4xl items-center gap-6 px-6">
          <Link href="/" className="text-[13px] font-semibold tracking-tight text-white">
            stits
          </Link>
          <div className="hidden flex-1 gap-5 text-[12px] md:flex">
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
          <div className="flex flex-1 justify-end gap-1 md:flex-none md:gap-0">
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
              onClick={() =>
                setTheme(THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length])
              }
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
          </div>
        </nav>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-black/80 pb-[env(safe-area-inset-bottom)] pt-1.5 [backdrop-filter:saturate(180%)_blur(20px)] md:hidden"
        aria-label="Primary"
      >
        {links.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={active ? { color: ACTIVE_TINT } : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-medium transition-colors active:opacity-60 ${
                active ? "" : "text-white/45"
              }`}
            >
              <TabBarIcon name={icon} active={active} className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
