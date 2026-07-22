"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/schedule", label: "Schedule" },
  { href: "/todos", label: "Todos" },
  { href: "/other", label: "Other" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-black/[.08] dark:border-white/[.145]">
      <nav className="mx-auto flex max-w-3xl items-center gap-6 px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          stits
        </Link>
        <div className="flex gap-4 text-sm">
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
      </nav>
    </header>
  );
}
