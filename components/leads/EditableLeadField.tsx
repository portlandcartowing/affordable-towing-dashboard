"use client";

import { useState, useTransition } from "react";
import { updateLeadField } from "@/app/leads/actions";

type Variant = "text" | "number" | "select";
type Field = "service" | "city" | "source" | "price";

export default function EditableLeadField({
  leadId,
  field,
  initialValue,
  variant,
  options,
  placeholder = "—",
  className = "",
  displayAs,
}: {
  leadId: string;
  field: Field;
  initialValue: string | number | null;
  variant: Variant;
  /** Only used for variant="select" — list of allowed values. */
  options?: string[];
  placeholder?: string;
  className?: string;
  /** Custom render for the non-editing state; defaults to raw value. */
  displayAs?: (value: string | number | null) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(initialValue != null ? String(initialValue) : "");
  const [current, setCurrent] = useState<string | number | null>(initialValue);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    setErr(null);
    const trimmed = value.trim();
    const next = trimmed === ""
      ? null
      : variant === "number"
        ? Number(trimmed)
        : trimmed;

    startTransition(async () => {
      const res = await updateLeadField(leadId, field, next);
      if (res.ok) {
        setCurrent(next);
        setEditing(false);
      } else {
        setErr(res.error);
      }
    });
  };

  const cancel = () => {
    setValue(current != null ? String(current) : "");
    setErr(null);
    setEditing(false);
  };

  const display = displayAs
    ? displayAs(current)
    : current != null && current !== ""
      ? String(current)
      : <span className="text-slate-400">{placeholder}</span>;

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
        className={`${className} cursor-pointer hover:text-blue-600 hover:underline decoration-dotted underline-offset-2 transition-colors`}
        title="Click to edit"
      >
        {display}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {variant === "select" ? (
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          disabled={isPending}
          autoFocus
          className="text-sm border border-slate-300 rounded px-1.5 py-1"
        >
          <option value="">—</option>
          {(options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={variant === "number" ? "number" : "text"}
          inputMode={variant === "number" ? "decimal" : undefined}
          min={variant === "number" ? 0 : undefined}
          max={variant === "number" ? 20000 : undefined}
          step={variant === "number" ? 1 : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          disabled={isPending}
          autoFocus
          className={`text-sm border border-slate-300 rounded px-1.5 py-1 ${variant === "number" ? "w-24 tabular-nums" : "w-32"}`}
        />
      )}
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
    </span>
  );
}

export const SERVICE_OPTIONS: string[] = [
  "Tow",
  "Tire",
  "Jump",
  "Lockout",
  "Gas",
  "Roadside",
];
