"use client";

import { useState, useTransition } from "react";
import { updateJobAddress } from "@/app/jobs/jobActions";

/**
 * Click the city to expand a small form where the dispatcher can edit the
 * full street / city / state / zip for a job's pickup or dropoff. When
 * collapsed, shows "City, State" or a placeholder dash.
 */
export default function EditableAddress({
  jobId,
  which,
  initial,
}: {
  jobId: string;
  which: "pickup" | "dropoff";
  initial: {
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const [addr, setAddr] = useState(initial.address ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [state, setState] = useState(initial.state ?? "");
  const [zip, setZip] = useState(initial.zip ?? "");
  const [current, setCurrent] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const cityLabel = [current.city, current.state].filter(Boolean).join(", ");
  const hasStreet = !!current.address;

  const save = () => {
    setErr(null);
    startTransition(async () => {
      const res = await updateJobAddress(jobId, which, {
        address: addr,
        city,
        state,
        zip,
      });
      if (res.ok) {
        setCurrent({
          address: addr.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          zip: zip.trim() || null,
        });
        setExpanded(false);
      } else {
        setErr(res.error);
      }
    });
  };

  const cancel = () => {
    setAddr(current.address ?? "");
    setCity(current.city ?? "");
    setState(current.state ?? "");
    setZip(current.zip ?? "");
    setErr(null);
    setExpanded(false);
  };

  if (!expanded) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(true);
          }
        }}
        className="cursor-pointer inline-flex flex-col items-start hover:text-blue-600 hover:underline decoration-dotted underline-offset-2 transition-colors"
        title={hasStreet ? current.address! : "Click to add address"}
      >
        <span className={cityLabel ? "text-slate-700" : "text-slate-400"}>
          {cityLabel || "—"}
        </span>
        {hasStreet && (
          <span className="text-[10px] text-slate-500 truncate max-w-[200px]">
            {current.address}
          </span>
        )}
      </span>
    );
  }

  return (
    <div
      className="space-y-1.5 bg-slate-50 border border-slate-200 rounded-lg p-2 inline-block min-w-[220px]"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        placeholder="Street address"
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
        disabled={isPending}
        autoFocus
        className="w-full text-xs border border-slate-300 rounded px-1.5 py-1"
      />
      <div className="flex gap-1.5">
        <input
          type="text"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          disabled={isPending}
          className="flex-1 text-xs border border-slate-300 rounded px-1.5 py-1"
        />
        <input
          type="text"
          placeholder="ST"
          maxLength={2}
          value={state}
          onChange={(e) => setState(e.target.value.toUpperCase())}
          disabled={isPending}
          className="w-10 text-xs border border-slate-300 rounded px-1.5 py-1 uppercase"
        />
        <input
          type="text"
          placeholder="ZIP"
          maxLength={10}
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          disabled={isPending}
          className="w-16 text-xs border border-slate-300 rounded px-1.5 py-1 tabular-nums"
        />
      </div>
      <div className="flex items-center gap-1.5 justify-end">
        <button
          type="button"
          onClick={cancel}
          disabled={isPending}
          className="text-[11px] text-slate-500 hover:text-slate-700 px-1.5 py-0.5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-2 py-0.5 rounded"
        >
          {isPending ? "…" : "Save"}
        </button>
      </div>
      {err && <div className="text-[10px] text-rose-600">{err}</div>}
    </div>
  );
}
