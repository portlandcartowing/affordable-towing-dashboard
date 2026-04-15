"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QueuePanel from "./components/QueuePanel";
import TranscriptPanel from "./components/TranscriptPanel";
import CopilotPanel from "./components/CopilotPanel";
import ExtractedFieldsPanel from "./components/ExtractedFieldsPanel";
import QuoteHelper, { type QuoteHelperState } from "./components/QuoteHelper";
import CallActions from "./components/CallActions";
import CloseReadiness, { getReadiness } from "./components/CloseReadiness";
import NotesPanel from "./components/NotesPanel";
import { LostReasonModal, CallbackModal } from "./components/Modals";
import {
  DriverNotificationPreview,
  CustomerConfirmationPreview,
  PostCallSummary,
} from "./components/Previews";
import StatusBadge from "./components/StatusBadge";
import { deriveExtractedFields } from "./extract";
import type { CallCenterCall, CallCenterStatus, LostReason } from "./types";

type Props = { initialCalls: CallCenterCall[] };
type CallMap = Record<string, CallCenterCall>;

function toMap(calls: CallCenterCall[]): CallMap {
  return Object.fromEntries(calls.map((c) => [c.id, c]));
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CallCenterClient({ initialCalls }: Props) {
  const [calls, setCalls] = useState<CallMap>(() => toMap(initialCalls));
  const [selectedId, setSelectedId] = useState<string>(
    () => initialCalls.find((c) => c.status === "live")?.id ?? initialCalls[0].id,
  );
  const [showLostModal, setShowLostModal] = useState(false);
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const selected = calls[selectedId];
  const callList = useMemo(
    () =>
      Object.values(calls).sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      ),
    [calls],
  );

  const patch = useCallback(
    (id: string, updater: (c: CallCenterCall) => CallCenterCall) => {
      setCalls((prev) => ({ ...prev, [id]: updater(prev[id]) }));
    },
    [],
  );

  // ---- mock live transcript streamer ----
  useEffect(() => {
    if (!selected || selected.status !== "live") return;
    if (!selected.scripted_remaining || selected.scripted_remaining.length === 0)
      return;

    const t = setTimeout(() => {
      patch(selected.id, (c) => {
        if (!c.scripted_remaining || c.scripted_remaining.length === 0) return c;
        const [next, ...rest] = c.scripted_remaining;
        const transcript = [...c.transcript, next];
        return {
          ...c,
          transcript,
          scripted_remaining: rest,
          duration_seconds: c.duration_seconds + 3,
          extracted: deriveExtractedFields(transcript, c.extracted),
        };
      });
    }, 2500);
    return () => clearTimeout(t);
  }, [selected, patch]);

  const quoteState: QuoteHelperState | null = selected
    ? {
        service_type: selected.extracted.service_type.value ?? "Tow",
        quote_base: selected.quote_base,
        quote_mileage: selected.quote_mileage,
        quote_non_runner: selected.quote_non_runner,
        quote_after_hours: selected.quote_after_hours,
        final_quote: selected.final_quote,
      }
    : null;

  const handleQuoteChange = (patchState: Partial<QuoteHelperState>) => {
    if (!selected) return;
    patch(selected.id, (c) => ({
      ...c,
      quote_base: patchState.quote_base ?? c.quote_base,
      quote_mileage: patchState.quote_mileage ?? c.quote_mileage,
      quote_non_runner: patchState.quote_non_runner ?? c.quote_non_runner,
      quote_after_hours: patchState.quote_after_hours ?? c.quote_after_hours,
      final_quote:
        patchState.final_quote !== undefined
          ? patchState.final_quote
          : c.final_quote,
      extracted: patchState.service_type
        ? {
            ...c.extracted,
            service_type: {
              value: patchState.service_type,
              confidence: "high",
            },
          }
        : c.extracted,
    }));
  };

  const handleSendToJob = (finalQuote: number) => {
    if (!selected) return;
    patch(selected.id, (c) => ({
      ...c,
      final_quote: finalQuote,
      extracted: {
        ...c.extracted,
        quoted_price: { value: finalQuote, confidence: "high" },
      },
    }));
    showToast(`Final quote $${finalQuote} locked in`);
  };

  const handleNotesChange = (value: string) => {
    if (!selected) return;
    patch(selected.id, (c) => ({ ...c, notes: value }));
  };

  const setStatus = (id: string, status: CallCenterStatus) =>
    patch(id, (c) => ({ ...c, status }));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const readiness = selected ? getReadiness(selected) : null;

  const handlers = selected
    ? {
        onMarkQuoted: () => {
          setStatus(selected.id, "quoted");
          showToast("Marked as quoted");
        },
        onBookJob: () => {
          patch(selected.id, (c) => ({
            ...c,
            status: "booked",
            extracted: {
              ...c.extracted,
              booked: { value: true, confidence: "high" },
            },
          }));
          showToast("Job booked · notifications staged");
        },
        onMarkLost: () => setShowLostModal(true),
        onSetCallback: () => setShowCallbackModal(true),
        onSendToDriver: () => showToast("Driver notification queued"),
        onSendConfirmation: () => showToast("Customer text queued"),
        onSaveNotes: () => showToast("Notes saved"),
      }
    : null;

  const confirmLost = (reason: LostReason) => {
    if (!selected) return;
    patch(selected.id, (c) => ({ ...c, status: "lost", lost_reason: reason }));
    setShowLostModal(false);
    showToast(`Lost · ${reason}`);
  };

  const confirmCallback = (iso: string) => {
    if (!selected) return;
    patch(selected.id, (c) => ({ ...c, status: "callback", callback_at: iso }));
    setShowCallbackModal(false);
    showToast(
      `Callback · ${new Date(iso).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
    );
  };

  // Book Job requires at least "almost_ready" — missing one field is OK
  // (usually customer name can be typed post-call), but the operator can't
  // book a blank slate.
  const canBook = Boolean(
    readiness && (readiness.level === "ready" || readiness.level === "almost_ready"),
  );

  if (!selected || !quoteState || !handlers || !readiness) {
    return <div className="p-6 text-sm text-slate-500">No calls in queue.</div>;
  }

  return (
    <div className="flex flex-col xl:flex-row h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] min-h-0 bg-slate-50">
      {/* ---------------- LEFT: QUEUE ---------------- */}
      <div className="xl:w-64 shrink-0 h-56 xl:h-full border-b xl:border-b-0 xl:border-r border-slate-200/70 min-h-0">
        <QueuePanel
          calls={callList}
          selectedId={selected.id}
          onSelect={setSelectedId}
        />
      </div>

      {/* ---------------- CENTER: WORKSPACE ---------------- */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto">
        <ActiveCallHeader call={selected} />

        <div className="flex-1 grid grid-cols-1 gap-3 p-3">
          <TranscriptPanel
            chunks={selected.transcript}
            status={selected.status}
          />

          {(selected.status === "booked" || selected.status === "completed") && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <DriverNotificationPreview call={selected} />
                <CustomerConfirmationPreview call={selected} />
              </div>
              <PostCallSummary call={selected} />
            </>
          )}

          {selected.status === "lost" && <PostCallSummary call={selected} />}

          {selected.status === "callback" && selected.callback_at && (
            <div className="bg-white rounded-2xl ring-1 ring-amber-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status="callback" size="md" />
                <span className="text-sm font-semibold text-slate-900">
                  Callback{" "}
                  {new Date(selected.callback_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Reminder fires in dispatcher inbox.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- RIGHT: OPERATOR TOOLS ---------------- */}
      <div className="xl:w-[340px] shrink-0 h-full min-h-0 border-t xl:border-t-0 xl:border-l border-slate-200/70 overflow-y-auto bg-slate-50">
        <div className="p-3 space-y-3">
          <CloseReadiness call={selected} />
          <CopilotPanel prompts={selected.copilot} />
          <ExtractedFieldsPanel fields={selected.extracted} />
          <QuoteHelper
            state={quoteState}
            onChange={handleQuoteChange}
            onSendToJob={handleSendToJob}
          />
          <NotesPanel value={selected.notes} onChange={handleNotesChange} />
          <CallActions
            status={selected.status}
            handlers={handlers}
            canBook={canBook}
          />
        </div>
      </div>

      {/* ---------------- MODALS ---------------- */}
      {showLostModal && (
        <LostReasonModal
          onCancel={() => setShowLostModal(false)}
          onConfirm={confirmLost}
        />
      )}
      {showCallbackModal && (
        <CallbackModal
          onCancel={() => setShowCallbackModal(false)}
          onConfirm={confirmCallback}
        />
      )}

      {/* ---------------- TOAST ---------------- */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActiveCallHeader — tight single-row header. Caller, status, duration,
// and context chips on one line.
// ---------------------------------------------------------------------------

function ActiveCallHeader({ call }: { call: CallCenterCall }) {
  const e = call.extracted;
  const vehicle = [e.vehicle_year.value, e.vehicle_make.value, e.vehicle_model.value]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="border-b border-slate-200/70 bg-white px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <StatusBadge status={call.status} pulse={call.status === "live"} size="md" />
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <div className="text-base md:text-lg font-bold text-slate-900 tabular-nums leading-none truncate">
            {call.caller_phone}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {call.dispatcher ? `· ${call.dispatcher}` : ""} · {call.source}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold leading-none">
            Duration
          </div>
          <div className="text-base font-bold text-slate-900 tabular-nums leading-tight">
            {formatDuration(call.duration_seconds)}
          </div>
        </div>
      </div>

      {(e.service_type.value || e.pickup_address.value || vehicle) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {e.service_type.value && <Chip label={e.service_type.value} tone="blue" />}
          {vehicle && <Chip label={vehicle} />}
          {e.pickup_address.value && (
            <Chip label={`◉ ${e.pickup_address.value}`} />
          )}
          {e.dropoff_address.value && (
            <Chip label={`➤ ${e.dropoff_address.value}`} />
          )}
          {call.final_quote != null && (
            <Chip label={`$${call.final_quote}`} tone="emerald" />
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ label, tone = "slate" }: { label: string; tone?: "slate" | "blue" | "emerald" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[tone];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium ${styles}`}>
      {label}
    </span>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
