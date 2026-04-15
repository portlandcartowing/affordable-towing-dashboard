"use client";

import type { CallCenterStatus } from "../types";

export type CallActionHandlers = {
  onMarkQuoted: () => void;
  onBookJob: () => void;
  onMarkLost: () => void;
  onSetCallback: () => void;
  onSendToDriver: () => void;
  onSendConfirmation: () => void;
  onSaveNotes: () => void;
};

export default function CallActions({
  status,
  handlers,
  canBook,
}: {
  status: CallCenterStatus;
  handlers: CallActionHandlers;
  canBook: boolean;
}) {
  const isClosed =
    status === "booked" || status === "lost" || status === "completed";

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Call Actions</h3>
      </div>

      {/* Primary actions — big tap targets */}
      <div className="grid grid-cols-2 gap-2">
        <BigButton
          variant="primary"
          disabled={!canBook || isClosed}
          onClick={handlers.onBookJob}
        >
          <span className="text-lg">✓</span> Book Job
        </BigButton>
        <BigButton
          variant="neutral"
          disabled={isClosed}
          onClick={handlers.onMarkQuoted}
        >
          $ Mark Quoted
        </BigButton>
        <BigButton
          variant="warning"
          disabled={isClosed}
          onClick={handlers.onSetCallback}
        >
          ⟳ Set Callback
        </BigButton>
        <BigButton
          variant="danger"
          disabled={isClosed}
          onClick={handlers.onMarkLost}
        >
          ✕ Mark Lost
        </BigButton>
      </div>

      {/* Secondary actions */}
      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 gap-2">
        <SmallButton
          onClick={handlers.onSendToDriver}
          disabled={status !== "booked"}
        >
          ➤ Send to Driver
        </SmallButton>
        <SmallButton
          onClick={handlers.onSendConfirmation}
          disabled={status !== "booked"}
        >
          ✉ Send Customer Confirmation
        </SmallButton>
        <SmallButton onClick={handlers.onSaveNotes}>💾 Save Notes</SmallButton>
      </div>
    </div>
  );
}

function BigButton({
  variant,
  disabled,
  onClick,
  children,
}: {
  variant: "primary" | "neutral" | "warning" | "danger";
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const style = {
    primary: "bg-emerald-600 hover:bg-emerald-700 text-white",
    neutral: "bg-indigo-600 hover:bg-indigo-700 text-white",
    warning: "bg-amber-500 hover:bg-amber-600 text-white",
    danger:  "bg-rose-600 hover:bg-rose-700 text-white",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-sm font-semibold transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${style}`}
    >
      {children}
    </button>
  );
}

function SmallButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
