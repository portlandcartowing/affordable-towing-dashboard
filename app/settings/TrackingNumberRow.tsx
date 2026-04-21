"use client";

import { useState, useTransition } from "react";
import type { TrackingNumber } from "@/lib/types";
import { updateTrackingNumberSource } from "./actions";

export default function TrackingNumberRow({ tn }: { tn: TrackingNumber }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tn.source);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setErr(null);
    startTransition(async () => {
      const res = await updateTrackingNumberSource(tn.id, value);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setEditing(false);
    });
  };

  const cancel = () => {
    setValue(tn.source);
    setErr(null);
    setEditing(false);
  };

  return (
    <li className="flex items-center justify-between py-3">
      <div>
        <div className="text-sm font-medium text-slate-900 tabular-nums">
          {tn.phone_number}
        </div>
        <div className="text-xs text-slate-500">{tn.label}</div>
      </div>
      <div className="text-right">
        {editing ? (
          <div className="flex items-center gap-2 justify-end">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") cancel();
              }}
              disabled={isPending}
              autoFocus
              className="text-xs border border-slate-300 rounded px-2 py-1 w-36"
            />
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={isPending}
              className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100"
            title="Click to edit source"
          >
            {tn.source}
          </button>
        )}
        <div className="text-[10px] text-slate-400 mt-0.5">{tn.channel}</div>
        {err && <div className="text-[10px] text-rose-600 mt-0.5">{err}</div>}
      </div>
    </li>
  );
}
