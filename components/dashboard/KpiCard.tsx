import Link from "next/link";

type Accent = "blue" | "indigo" | "emerald" | "amber" | "violet" | "slate";

type KpiCardProps = {
  title: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  icon?: string;
  accent?: Accent;
  href?: string;
};

const ACCENT: Record<Accent, { bg: string; fg: string }> = {
  blue:    { bg: "bg-blue-50",    fg: "text-blue-600" },
  indigo:  { bg: "bg-indigo-50",  fg: "text-indigo-600" },
  emerald: { bg: "bg-emerald-50", fg: "text-emerald-600" },
  amber:   { bg: "bg-amber-50",   fg: "text-amber-600" },
  violet:  { bg: "bg-violet-50",  fg: "text-violet-600" },
  slate:   { bg: "bg-slate-100",  fg: "text-slate-600" },
};

export default function KpiCard({
  title,
  value,
  delta,
  trend = "neutral",
  icon,
  accent = "slate",
  href,
}: KpiCardProps) {
  const trendColor =
    trend === "up"
      ? "text-emerald-600"
      : trend === "down"
      ? "text-rose-600"
      : "text-slate-500";
  const trendGlyph = trend === "up" ? "▲" : trend === "down" ? "▼" : "•";
  const a = ACCENT[accent];

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] md:text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {title}
        </div>
        {icon && (
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${a.bg} ${a.fg}`}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2 md:mt-3 text-2xl md:text-[28px] font-bold text-slate-900 tabular-nums leading-tight">
        {value}
      </div>
      {delta && (
        <div className={`mt-1.5 text-[11px] md:text-xs font-medium ${trendColor}`}>
          {trendGlyph} {delta}
        </div>
      )}
    </>
  );

  const baseClass =
    "group bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-shadow p-4 md:p-5";
  const clickableClass = href
    ? `${baseClass} cursor-pointer hover:ring-blue-300 active:scale-[0.98] transition-all`
    : baseClass;

  if (href) {
    return (
      <Link href={href} className={`${clickableClass} block`}>
        {content}
      </Link>
    );
  }

  return <div className={clickableClass}>{content}</div>;
}
