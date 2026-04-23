"use client";

import { useState, useTransition } from "react";
import { updateCustomerNameByPhone } from "@/app/calls/actions";

export default function EditableCustomerName({
  phone,
  initialName,
  placeholder = "Unknown",
  className = "",
}: {
  phone: string | null;
  initialName: string | null;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(initialName ?? "");
  const [name, setName] = useState<string | null>(initialName);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (!phone) {
    return <span className={className}>{name || placeholder}</span>;
  }

  const save = () => {
    setErr(null);
    startTransition(async () => {
      const res = await updateCustomerNameByPhone(phone, value);
      if (res.ok) {
        setName(value.trim() || null);
        setEditing(false);
      } else {
        setErr(res.error);
      }
    });
  };

  const cancel = () => {
    setValue(name ?? "");
    setErr(null);
    setEditing(false);
  };

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
        title="Click to edit name (applies to all calls from this number)"
      >
        {name || <span className="text-slate-400">{placeholder}</span>}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
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
        placeholder="Name"
        className="w-28 text-sm border border-slate-300 rounded px-1.5 py-1"
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
    </span>
  );
}
