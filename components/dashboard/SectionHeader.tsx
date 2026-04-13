export default function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-3 md:mb-4 gap-3">
      <div className="min-w-0">
        <h2 className="text-[11px] md:text-xs font-semibold text-slate-500 uppercase tracking-[0.08em]">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
