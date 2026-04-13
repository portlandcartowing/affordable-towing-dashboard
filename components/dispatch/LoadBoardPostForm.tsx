"use client";

// Placeholder form for posting a job to a load board. Real submission will
// call a server action that invokes the matching LoadBoardAdapter from
// lib/loadBoard.ts. UI only for now.

import { useState } from "react";
import { AVAILABLE_PROVIDERS } from "@/lib/loadBoard";
import type { Job, LoadBoardProvider } from "@/lib/types";

export default function LoadBoardPostForm({ job }: { job: Job }) {
  const [provider, setProvider] = useState<LoadBoardProvider>("central_dispatch");
  const [priceOffered, setPriceOffered] = useState(job.price?.toString() ?? "");
  const [driverPay, setDriverPay] = useState(job.driver_pay?.toString() ?? "");
  const [notes, setNotes] = useState("");

  const input =
    "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100";
  const label = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // TODO: server action -> getAdapter(provider).post({ job, ... })
        alert("Load board integration not implemented yet.");
      }}
      className="space-y-4"
    >
      <div>
        <label className={label}>Load Board</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as LoadBoardProvider)}
          className={input}
        >
          {AVAILABLE_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Price Offered</label>
          <input
            type="number"
            value={priceOffered}
            onChange={(e) => setPriceOffered(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Driver Pay</label>
          <input
            type="number"
            value={driverPay}
            onChange={(e) => setDriverPay(e.target.value)}
            className={input}
          />
        </div>
      </div>

      <div>
        <label className={label}>Notes for drivers</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={input}
        />
      </div>

      <button
        type="submit"
        className="w-full px-4 py-3 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Post to Load Board
      </button>

      <p className="text-[11px] text-slate-400 text-center">
        Integration stub — no external request will be sent.
      </p>
    </form>
  );
}
