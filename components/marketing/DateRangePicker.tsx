"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DateRange } from "@/lib/googleAds";

const PRESETS = [
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

export default function DateRangePicker({ range }: { range: DateRange }) {
  const router = useRouter();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  const applyPreset = (days: number) => {
    router.push(`/marketing?days=${days}`);
  };

  const applyCustom = () => {
    router.push(`/marketing?from=${from}&to=${to}`);
  };

  const input =
    "px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => applyPreset(p.days)}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={input}
        />
        <span className="text-slate-400 text-xs">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={input}
        />
        <button
          onClick={applyCustom}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
