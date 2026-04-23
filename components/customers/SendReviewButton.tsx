"use client";

import { useState, useTransition } from "react";
import { sendReviewLink } from "@/app/customers/actions";

export default function SendReviewButton({ phone }: { phone: string }) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const handleClick = () => {
    if (!confirm("Send the Google review link to this customer?")) return;
    startTransition(async () => {
      const res = await sendReviewLink(phone);
      if (res.ok) {
        setToast("Sent");
      } else {
        setToast(`Failed: ${res.error.slice(0, 40)}`);
      }
      setTimeout(() => setToast(null), 3000);
    });
  };

  return (
    <div className="flex items-center gap-2">
      {toast && (
        <span className="text-xs font-medium text-emerald-600">{toast}</span>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Sending…" : "Send Review Link"}
      </button>
    </div>
  );
}
