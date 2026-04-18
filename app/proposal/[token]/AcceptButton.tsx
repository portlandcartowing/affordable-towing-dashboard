"use client";

import { useState, useTransition } from "react";
import { acceptProposalAction } from "./actions";

export default function AcceptButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const res = await acceptProposalAction(token);
      if (!res.ok) {
        setError(res.error || "Something went wrong");
        return;
      }
      setDone(true);
    });
  };

  if (done) {
    return (
      <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-2xl p-5 text-center">
        <div className="text-2xl mb-2">✓</div>
        <div className="text-sm font-bold text-emerald-800">Quote Accepted!</div>
        <div className="text-xs text-emerald-600 mt-1">
          Your driver is being dispatched. We&apos;ll call you shortly.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold shadow-lg shadow-emerald-600/25 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Accepting…" : "✓ Accept Quote"}
      </button>
      {error && (
        <div className="text-center text-xs text-rose-600">{error}</div>
      )}
      <p className="text-center text-[11px] text-slate-400">
        Tap to confirm this towing job at the price shown above.
      </p>
    </div>
  );
}
