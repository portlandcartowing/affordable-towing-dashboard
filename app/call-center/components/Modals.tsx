"use client";

import { useState } from "react";
import { LOST_REASONS, type LostReason } from "../types";

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function LostReasonModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (reason: LostReason) => void;
}) {
  const [selected, setSelected] = useState<LostReason | null>(null);
  return (
    <ModalShell title="Mark Lost" onClose={onCancel}>
      <p className="text-xs text-slate-500 mb-3">
        Tag a reason. Transcript and quote are preserved.
      </p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {LOST_REASONS.map((reason) => {
          const active = selected === reason;
          return (
            <button
              key={reason}
              type="button"
              onClick={() => setSelected(reason)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? "bg-rose-600 border-rose-600 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              }`}
            >
              {active ? "✓ " : ""}
              {reason}
            </button>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
          className="px-3 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400"
        >
          Mark Lost
        </button>
      </div>
    </ModalShell>
  );
}

export function CallbackModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (iso: string) => void;
}) {
  // Default to 30 minutes from now, formatted for datetime-local input.
  const defaultLocal = (() => {
    const d = new Date(Date.now() + 30 * 60_000);
    d.setSeconds(0, 0);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();
  const [value, setValue] = useState(defaultLocal);

  const quick = (minutes: number) => {
    const d = new Date(Date.now() + minutes * 60_000);
    d.setSeconds(0, 0);
    const pad = (n: number) => n.toString().padStart(2, "0");
    setValue(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
  };

  return (
    <ModalShell title="Set Callback" onClose={onCancel}>
      <p className="text-xs text-slate-500 mb-3">
        Schedule a reminder to call the customer back.
      </p>

      <div className="flex gap-1 mb-3">
        {[
          { label: "+15m", m: 15 },
          { label: "+30m", m: 30 },
          { label: "+1h", m: 60 },
          { label: "+2h", m: 120 },
        ].map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => quick(q.m)}
            className="flex-1 px-2 py-1.5 text-[11px] font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            {q.label}
          </button>
        ))}
      </div>

      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 mb-4"
      />

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(new Date(value).toISOString())}
          className="px-3 py-2 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600"
        >
          Schedule
        </button>
      </div>
    </ModalShell>
  );
}
