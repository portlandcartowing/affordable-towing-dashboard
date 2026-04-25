"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_LINKS } from "@/lib/nav";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Hide on customer-facing public routes
  if (pathname?.startsWith("/track") || pathname?.startsWith("/proposal")) {
    return null;
  }

  return (
    <aside
      className={`hidden md:flex md:flex-col shrink-0 bg-white border-r border-slate-200/70 h-screen sticky top-0 transition-[width] duration-200 ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-100">
        {!collapsed ? (
          <div className="min-w-0 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
              ACT
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate leading-tight">
                Affordable Towing
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">CRM</div>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm mx-auto">
            AT
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="w-7 h-7 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href || pathname?.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              } ${collapsed ? "justify-center" : ""}`}
            >
              {active && !collapsed && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-blue-600" />
              )}
              <span
                className={`text-base shrink-0 ${
                  active ? "text-blue-600" : "text-slate-400"
                }`}
              >
                {link.icon}
              </span>
              {!collapsed && <span className="truncate">{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-4 py-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Supabase connected
          </div>
        </div>
      )}
    </aside>
  );
}
