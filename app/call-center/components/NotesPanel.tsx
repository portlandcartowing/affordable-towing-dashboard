"use client";

export default function NotesPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-3.5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
          Notes
        </h3>
        <span className="text-[9px] uppercase tracking-wider text-slate-400 tabular-nums">
          {value.length} chars
        </span>
      </div>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Anything the driver needs to know…"
        className="w-full px-2.5 py-2 text-xs leading-relaxed border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 resize-none"
      />
    </div>
  );
}
