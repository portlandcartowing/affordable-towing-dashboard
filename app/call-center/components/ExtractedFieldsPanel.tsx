"use client";

import type { ExtractedFields, Confidence } from "../types";

const FIELD_ORDER: {
  key: keyof ExtractedFields;
  label: string;
}[] = [
  { key: "customer_name",     label: "Customer Name" },
  { key: "callback_phone",    label: "Callback Phone" },
  { key: "service_type",      label: "Service" },
  { key: "pickup_address",    label: "Pickup" },
  { key: "dropoff_address",   label: "Dropoff" },
  { key: "vehicle_year",      label: "Year" },
  { key: "vehicle_make",      label: "Make" },
  { key: "vehicle_model",     label: "Model" },
  { key: "running_condition", label: "Condition" },
  { key: "issue_type",        label: "Issue" },
  { key: "urgency",           label: "Urgency" },
  { key: "quoted_price",      label: "Quoted" },
];

const CONF_STYLE: Record<Confidence, { dot: string; label: string; bar: string }> = {
  high:         { dot: "bg-emerald-500", label: "high",   bar: "bg-emerald-500" },
  medium:       { dot: "bg-amber-400",   label: "med",    bar: "bg-amber-400" },
  needs_review: { dot: "bg-slate-300",   label: "review", bar: "bg-slate-300" },
};

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return `$${v}`;
  return String(v);
}

export default function ExtractedFieldsPanel({
  fields,
}: {
  fields: ExtractedFields;
}) {
  // Count how many fields have real values vs needs_review.
  const total = FIELD_ORDER.length;
  let captured = 0;
  for (const { key } of FIELD_ORDER) {
    if (fields[key].value != null) captured += 1;
  }
  const pct = Math.round((captured / total) * 100);

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Extracted Fields</h3>
        <span className="text-[11px] tabular-nums text-slate-500">
          {captured}/{total} captured
        </span>
      </div>

      {/* Capture progress bar */}
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {FIELD_ORDER.map(({ key, label }) => {
          const field = fields[key];
          const conf = CONF_STYLE[field.confidence];
          const hasValue = field.value != null;
          return (
            <li key={key} className="flex items-center gap-2 text-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${conf.dot}`}
                title={`confidence: ${conf.label}`}
              />
              <span className="text-slate-500 w-[84px] shrink-0">{label}</span>
              <span
                className={`flex-1 truncate ${
                  hasValue ? "font-medium text-slate-900" : "text-slate-400"
                }`}
                title={hasValue ? formatValue(field.value) : undefined}
              >
                {formatValue(field.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
