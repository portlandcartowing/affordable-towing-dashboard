"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Result = {
  type: "call" | "lead" | "job" | "driver";
  id: string;
  title: string;
  subtitle: string | null;
  preview: string | null;
  href: string;
};

const TYPE_BADGE: Record<Result["type"], { label: string; cls: string }> = {
  call:   { label: "Call",   cls: "bg-violet-50 text-violet-700"   },
  lead:   { label: "Lead",   cls: "bg-amber-50 text-amber-700"     },
  job:    { label: "Job",    cls: "bg-emerald-50 text-emerald-700" },
  driver: { label: "Driver", cls: "bg-blue-50 text-blue-700"       },
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Open on Cmd/Ctrl-K from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Debounced fetch
  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (!cancelled) setResults(json.results || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors"
        aria-label="Search (Ctrl+K)"
        title="Search (Ctrl+K)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(92vw,28rem)] bg-white rounded-xl ring-1 ring-slate-200 shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 shrink-0">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search calls, leads, jobs, drivers…"
              className="flex-1 text-sm outline-none placeholder-slate-400 bg-transparent"
              type="search"
              autoComplete="off"
            />
            <kbd className="hidden sm:inline-block text-[10px] text-slate-400 px-1.5 py-0.5 rounded border border-slate-200">esc</kbd>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {q.trim().length < 2 && (
              <div className="px-4 py-6 text-center text-xs text-slate-400">
                Type at least 2 characters. Searches transcripts, addresses, vehicles, names, phones, and more.
              </div>
            )}

            {q.trim().length >= 2 && loading && (
              <div className="px-4 py-6 text-center text-xs text-slate-400">Searching…</div>
            )}

            {q.trim().length >= 2 && !loading && results.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-slate-400">No results.</div>
            )}

            {results.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {results.map((r) => (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      onClick={() => go(r.href)}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-start gap-2.5"
                    >
                      <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0 ${TYPE_BADGE[r.type].cls}`}>
                        {TYPE_BADGE[r.type].label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 truncate">{r.title}</div>
                        {r.subtitle && (
                          <div className="text-[11px] text-slate-500 truncate">{r.subtitle}</div>
                        )}
                        {r.preview && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">{r.preview}</div>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
