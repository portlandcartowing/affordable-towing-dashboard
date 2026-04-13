"use client";

import { useState, useTransition } from "react";
import { toggleLeadBooked } from "@/app/leads/actions";

export default function BookedToggle({ id, booked }: { id: string; booked: boolean }) {
  const [value, setValue] = useState(booked);
  const [isPending, startTransition] = useTransition();

  const onToggle = () => {
    const next = !value;
    setValue(next);
    startTransition(async () => {
      const res = await toggleLeadBooked(id, next);
      if (!res.ok) setValue(!next);
    });
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isPending}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        value ? "bg-emerald-500" : "bg-slate-300"
      } ${isPending ? "opacity-60" : ""}`}
      aria-pressed={value}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
