"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateCustomerNameByPhone } from "@/app/calls/actions";

export default function EditableCustomerName({
  phone,
  initialName,
  placeholder = "Unknown",
  className = "",
  linkToProfile = true,
}: {
  phone: string | null;
  initialName: string | null;
  placeholder?: string;
  className?: string;
  linkToProfile?: boolean;
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
    const display = name || <span className="text-slate-400">{placeholder}</span>;
    const profileHref = `/customers/${encodeURIComponent(phone)}`;
    return (
      <span className="inline-flex items-center gap-1.5">
        {linkToProfile ? (
          <Link
            href={profileHref}
            onClick={(e) => e.stopPropagation()}
            className={`${className} hover:text-blue-600 hover:underline transition-colors`}
            title="Open customer profile"
          >
            {display}
          </Link>
        ) : (
          <span className={className}>{display}</span>
        )}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setEditing(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setEditing(true);
            }
          }}
          className="cursor-pointer text-slate-300 hover:text-blue-600 transition-colors leading-none"
          title="Edit name"
          aria-label="Edit customer name"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </span>
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
