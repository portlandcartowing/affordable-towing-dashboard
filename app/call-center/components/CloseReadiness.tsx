"use client";

import type { CallCenterCall, ExtractedFields } from "../types";

// ---------------------------------------------------------------------------
// Close-readiness derivation. One source of truth for both the missing-info
// checklist and the Book Job button gate.
// ---------------------------------------------------------------------------

export type ReadinessLevel = "not_ready" | "almost_ready" | "ready";

type Requirement = {
  key: keyof ExtractedFields | "final_quote";
  label: string;
  filled: (call: CallCenterCall) => boolean;
};

const REQUIREMENTS: Requirement[] = [
  {
    key: "service_type",
    label: "Service type",
    filled: (c) => c.extracted.service_type.value != null,
  },
  {
    key: "pickup_address",
    label: "Pickup location",
    filled: (c) => c.extracted.pickup_address.value != null,
  },
  {
    key: "vehicle_make",
    label: "Vehicle",
    filled: (c) =>
      c.extracted.vehicle_make.value != null ||
      c.extracted.vehicle_model.value != null,
  },
  {
    key: "callback_phone",
    label: "Callback number",
    filled: (c) =>
      c.extracted.callback_phone.value != null ||
      call_phoneFilled(c.caller_phone),
  },
  {
    key: "final_quote",
    label: "Final quote",
    filled: (c) => c.final_quote != null,
  },
];

function call_phoneFilled(phone: string | null) {
  return !!phone && phone.replace(/\D/g, "").length >= 7;
}

export function getReadiness(call: CallCenterCall): {
  level: ReadinessLevel;
  filled: number;
  total: number;
  checklist: { label: string; filled: boolean }[];
} {
  const checklist = REQUIREMENTS.map((r) => ({
    label: r.label,
    filled: r.filled(call),
  }));
  const filled = checklist.filter((c) => c.filled).length;
  const total = checklist.length;
  const level: ReadinessLevel =
    filled >= total ? "ready" : filled >= 3 ? "almost_ready" : "not_ready";
  return { level, filled, total, checklist };
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

const LEVEL_STYLE: Record<
  ReadinessLevel,
  { label: string; bar: string; text: string; chip: string }
> = {
  not_ready: {
    label: "Not ready",
    bar: "bg-rose-500",
    text: "text-rose-700",
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
  },
  almost_ready: {
    label: "Almost ready",
    bar: "bg-amber-500",
    text: "text-amber-700",
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  ready: {
    label: "Ready to close",
    bar: "bg-emerald-500",
    text: "text-emerald-700",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
};

export default function CloseReadiness({ call }: { call: CallCenterCall }) {
  const { level, filled, total, checklist } = getReadiness(call);
  const style = LEVEL_STYLE[level];
  const pct = Math.round((filled / total) * 100);

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-3.5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
          Close Readiness
        </h3>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ${style.chip}`}
        >
          {style.label}
        </span>
      </div>

      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full ${style.bar} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="grid grid-cols-1 gap-1">
        {checklist.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-2 text-[11px] tabular-nums"
          >
            <span
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                item.filled
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {item.filled ? "✓" : "○"}
            </span>
            <span
              className={
                item.filled ? "text-slate-700 font-medium" : "text-slate-400"
              }
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
