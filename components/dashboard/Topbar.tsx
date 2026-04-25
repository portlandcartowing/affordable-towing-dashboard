import GlobalSearch from "./GlobalSearch";

export default function Topbar({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-slate-200/70">
      <div className="flex items-center justify-between gap-3 px-4 md:px-8 h-14 md:h-16">
        <div className="min-w-0">
          <h1 className="text-base md:text-xl font-semibold text-slate-900 truncate tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] md:text-xs text-slate-500 hidden sm:block truncate">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          <GlobalSearch />
          <button
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold ring-1 ring-white shadow-sm"
            aria-label="Account"
          >
            ACT
          </button>
        </div>
      </div>
    </header>
  );
}
