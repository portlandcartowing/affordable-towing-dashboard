export default function EmptyState({
  icon = "◌",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 text-xl flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {description && (
        <div className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          {description}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
