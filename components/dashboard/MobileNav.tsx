"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/nav";

export default function MobileNav() {
  const pathname = usePathname();
  const items = NAV_LINKS.filter((l) => l.mobile);

  // Hide on customer-facing public routes
  if (pathname?.startsWith("/track") || pathname?.startsWith("/proposal")) {
    return null;
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/70 pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {items.map((link) => {
          const active = pathname === link.href || pathname?.startsWith(link.href + "/");
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] text-[11px] font-medium transition-colors ${
                  active ? "text-blue-600" : "text-slate-500 active:text-slate-900"
                }`}
              >
                {active && (
                  <span className="absolute top-0 h-[3px] w-10 rounded-full bg-blue-600" />
                )}
                <span className="text-lg leading-none">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
