"use client";

import type { CallCenterCall } from "../types";

// ---------------------------------------------------------------------------
// DriverNotificationPreview — shown after Book Job. Mimics the message the
// on-call driver will see in their dispatch app / SMS once real integration
// is wired up.
// ---------------------------------------------------------------------------

export function DriverNotificationPreview({ call }: { call: CallCenterCall }) {
  const e = call.extracted;
  const vehicle = [e.vehicle_year.value, e.vehicle_make.value, e.vehicle_model.value]
    .filter(Boolean)
    .join(" ");
  const service = e.service_type.value ?? "Service";
  const pickup = e.pickup_address.value ?? "TBD";
  const dropoff = e.dropoff_address.value ?? null;
  const price = call.final_quote ?? e.quoted_price.value;
  const customer = e.customer_name.value ?? "Customer";

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Driver Notification</h3>
        <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">
          ready to send
        </span>
      </div>

      <div className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono leading-relaxed">
        <div className="text-emerald-300 font-semibold mb-1">
          🛻 NEW JOB · {service.toUpperCase()}
        </div>
        <div>
          <span className="text-slate-400">Customer:</span> {customer}
        </div>
        <div>
          <span className="text-slate-400">Phone:</span> {e.callback_phone.value || call.caller_phone}
        </div>
        {vehicle && (
          <div>
            <span className="text-slate-400">Vehicle:</span> {vehicle}
          </div>
        )}
        <div>
          <span className="text-slate-400">Pickup:</span> {pickup}
        </div>
        {dropoff && (
          <div>
            <span className="text-slate-400">Dropoff:</span> {dropoff}
          </div>
        )}
        {price != null && (
          <div>
            <span className="text-slate-400">Payout:</span>{" "}
            <span className="text-emerald-300">${Math.round(price * 0.6)}</span>
          </div>
        )}
        {call.notes && (
          <div className="mt-2 pt-2 border-t border-slate-700 text-slate-300">
            📝 {call.notes}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CustomerConfirmationPreview — text message the customer receives.
// ---------------------------------------------------------------------------

export function CustomerConfirmationPreview({ call }: { call: CallCenterCall }) {
  const e = call.extracted;
  const customer = e.customer_name.value?.split(" ")[0] ?? "there";
  const eta = "20 minutes";
  const price = call.final_quote ?? e.quoted_price.value;

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Customer Confirmation</h3>
        <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">
          ready to send
        </span>
      </div>

      <div className="max-w-xs ml-auto">
        <div className="bg-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
          Hi {customer}! This is Portland Car Towing confirming your job.
          {price != null && <> Total is <b>${price}</b>.</>} A driver is on the
          way, ETA ~{eta}. Reply STOP to opt out.
        </div>
        <div className="text-[10px] text-slate-400 text-right mt-1 mr-1">
          SMS · to {e.callback_phone.value || call.caller_phone}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostCallSummary — the single source of truth for "what happened on this
// call" after it closes. Four stacked sections: one-sentence AI summary,
// extracted fields, dispatcher notes, final disposition (status + lost
// reason / booked quote / callback time).
// ---------------------------------------------------------------------------

import { STATUS_LABEL, STATUS_STYLE } from "../types";

export function PostCallSummary({ call }: { call: CallCenterCall }) {
  const e = call.extracted;
  const fields = [
    ["Service", e.service_type.value],
    ["Customer", e.customer_name.value],
    ["Phone", e.callback_phone.value || call.caller_phone],
    ["Pickup", e.pickup_address.value],
    ["Dropoff", e.dropoff_address.value],
    [
      "Vehicle",
      [e.vehicle_year.value, e.vehicle_make.value, e.vehicle_model.value]
        .filter(Boolean)
        .join(" ") || null,
    ],
    ["Condition", e.running_condition.value],
    ["Urgency", e.urgency.value],
  ];

  const s = STATUS_STYLE[call.status];

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Post-Call Summary</h3>
        <span className="text-[10px] uppercase tracking-wider text-slate-400">
          parsed · saved
        </span>
      </div>

      {/* Section 1 — AI summary */}
      {call.ai_summary && (
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            AI Summary
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {call.ai_summary}
          </p>
        </div>
      )}

      {/* Section 2 — Structured fields, 2-column grid */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
          Extracted Fields
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          {fields.map(([label, value]) => (
            <li key={label} className="flex gap-2 min-w-0">
              <span className="text-slate-400 w-[70px] shrink-0">{label}</span>
              <span
                className={`truncate ${
                  value ? "text-slate-900 font-medium" : "text-slate-300"
                }`}
                title={value || undefined}
              >
                {value || "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Section 3 — Dispatcher notes */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
          Dispatcher Notes
        </div>
        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
          {call.notes || (
            <span className="text-slate-300 italic">No notes recorded.</span>
          )}
        </p>
      </div>

      {/* Section 4 — Final disposition */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${s.pill}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {STATUS_LABEL[call.status]}
          </span>
          <span className="text-[11px] text-slate-600 truncate">
            {dispositionText(call)}
          </span>
        </div>
      </div>
    </div>
  );
}

function dispositionText(call: CallCenterCall): string {
  switch (call.status) {
    case "booked":
      return call.final_quote != null
        ? `Booked at $${call.final_quote}`
        : "Booked";
    case "lost":
      return call.lost_reason ? `Lost · ${call.lost_reason}` : "Lost";
    case "callback":
      return call.callback_at
        ? `Callback · ${new Date(call.callback_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
        : "Callback scheduled";
    case "completed":
      return "Completed";
    case "quoted":
      return call.final_quote != null
        ? `Quoted $${call.final_quote}`
        : "Quoted";
    default:
      return "Open";
  }
}
