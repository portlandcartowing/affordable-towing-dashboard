"use client";

import { useState, useTransition } from "react";
import { updateJobPrice } from "@/app/jobs/jobActions";

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function EditablePrice({
  jobId,
  initialPrice,
  size = "md",
}: {
  jobId: string;
  initialPrice: number | null;
  size?: "sm" | "md" | "lg";
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(initialPrice != null ? String(initialPrice) : "");
  const [price, setPrice] = useState<number | null>(initialPrice);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    const trimmed = value.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (Number.isNaN(next) || next < 0 || next > 20000)) {
      setErr("Enter 0–20000");
      return;
    }
    setErr(null);
    startTransition(async () => {
      const res = await updateJobPrice(jobId, next);
      if (res.ok) {
        setPrice(next);
        setEditing(false);
      } else {
        setErr(res.error);
      }
    });
  };

  const cancel = () => {
    setValue(price != null ? String(price) : "");
    setErr(null);
    setEditing(false);
  };

  const displayCls =
    size === "lg" ? "text-lg font-bold" :
    size === "sm" ? "text-sm font-semibold" :
    "font-semibold";

  if (!editing) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setEditing(true);
          }
        }}
        className={`${displayCls} inline-block text-slate-900 cursor-pointer hover:text-blue-600 hover:underline decoration-dotted underline-offset-2 transition-colors`}
        title="Click to edit price"
      >
        {price != null ? money(price) : "—"}
      </span>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-slate-400 text-sm">$</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={20000}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") cancel();
        }}
        disabled={isPending}
        autoFocus
        className="w-20 text-sm border border-slate-300 rounded px-1.5 py-1 tabular-nums"
      />
      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
      >
        {isPending ? "…" : "Save"}
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={isPending}
        className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
      >
        Cancel
      </button>
      {err && <span className="text-[10px] text-rose-600 ml-1">{err}</span>}
    </div>
  );
}
